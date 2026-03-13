
import { sendEmail } from "@/actions/email-send";
import { db } from "../prisma";
import { inngest } from "./client";
import EmailTemplate from "@/emails/template";

export const checkBudgetAlert = inngest.createFunction(
  { name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" },
  async ({  step }) => {
    // firts step would be to fetch all the budget for all of the user  
    const budgets = await step.run("fectch-budget",async()=>{
        return await db.budget.findMany({
            include :{
                user :{
                    include :{
                        accounts:{
                            where :{
                                isDefault: true,
                            },
                        },
                    },
                },
            },
        });
    });

    // go through each budget and check if the amount spent exceeds then send the email
    for(const budget of budgets){
        const defaultAccount = budget.user.accounts[0];
        if(!defaultAccount) continue; // skip if no default account

        await step.run(`check-budget-${budget.id}`,async()=>{
            const currentDate = new Date();
            const StartOfMonth = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(), 
                1);
            const endOfMonth = new Date(
                currentDate.getFullYear(), 
                currentDate.getMonth() + 1, 
                0
            );

            const expenses = await db.transaction.aggregate({
                where: {
                    userId :budget.userId,
                    accountId: defaultAccount.id,
                    type:"EXPENSE",
                    date: {
                        gte: StartOfMonth,
                        lte: endOfMonth,
                    },
                },
                // THIS_sum will calculate ths sum of all the amount field
                _sum: {
                    amount: true,
                },
            });

            const totalExpenses = expenses._sum.amount?.toNumber() || 0;
            const budgetAmount = budget.amount;
            const percentageUsed = (totalExpenses/budgetAmount) * 100; // this is something that is the parameter to send the email 
            
            console.log(percentageUsed);

            if(percentageUsed >= 80 && (!budget.lastAlertSent || isNewMonth(new Date(budget.lastAlertSent),new Date()))
            ){
                // send email
                await sendEmail({
                    to: budget.user.email,
                    subject: `Budget Alert for ${defaultAccount.name}`,
                    react: EmailTemplate({
                        userName: budget.user.name,
                        type: "budget-alert",
                        data:{
                            percentageUsed,
                            budgetAmount:parseInt(budgetAmount).toFixed(1),
                            totalExpenses: parseInt(totalExpenses).toFixed(1),
                            accountName: defaultAccount.name,
                        }
                    }),
                });
                // update lastAlertSent
                await db.budget.update({
                    where: {id: budget.id},
                    data: {lastAlertSent: new Date()},
                });
            }
        });
    }
  }
);

function isNewMonth(lastAlertSent, currentDate){
    return(
        lastAlertSent.getMonth() !== currentDate.getMonth() ||
        lastAlertSent.getFullYear() !== currentDate.getFullYear()
    );
}

export const triggerRecurringTransaction = inngest.createFunction({
    id:"trigger-recurring-transactions",
    name:"Trigger Recurring Transactions",
},{cron:"0 0 * * *"},
 async ({step})=>{
    // 1. Fetch all due recurring transaction 
    const recurringTransaction = await step.run(
        "fetch-recurring-transactions",
        async () =>{
            return await db.transaction.findMany({
                where:{
                    isRecurring: true,
                    status:"COMPLETED",
                    OR: [
                        {lastProcessed:null}, // never processed
                        {nextRecurringDate:{lte:new Date()}}, // Due date passed
                    ],
                },
            });
        }
    );

    //2. Create events for each transaction 
    if(recurringTransaction.length >0){
        const events = recurringTransaction.map((transaction)=>({
            name: "transaction.recurring.process",
            data:{
                transactionId:transaction.id,
                userId:transaction.userId
            },
        }));
    
    // 3. Send events to be processed
        await inngest.send(events);
    }

    return {triggered: recurringTransaction.length};
 }
);

export const processRecurringTransaction = inngest.createFunction({
    id:"process-recurring-transaction",
    throttle:{
        limit:10, // only process 10 transcation
        period:"1m", // per minutes
        key:"event.date.userId", // per user
    },

},  { event:"transaction.recurring.process"},
    async ({event,step}) =>{
        // validate event data
        if(!event?.data?.transactionId || !event?.data?.userId){
            console.error("invalid event data",event);
            return{error:"Missing required event data"};
        }

        await step.run("process-transaction",async()=>{
            const transaction = await db.transaction.findUnique({
                where:{
                    id:event.data.transactionId,
                    userId:event.data.userId,
                },
                include:{
                    account:true,
                },
            });

            if(!transaction || !isTransactionDue(transaction)) return;

        await db.$transaction(async(tx)=>{
                // create new transaction 
                await tx.transaction.create({
                    data:{
                        type:transaction.type,
                        amount:transaction.amount,
                        description:`${transaction.description}(Recurring)`,
                        date: new Date(),
                        category: transaction.category,
                        userId:transaction.userId,
                        accountId:transaction.accountId,
                        isRecurring:false,
                    },
                });

                //update account balance 
                const balanceChange = 
                    transaction.type === "EXPENSE"
                    ? -transaction.amount.toNumber()
                    : transaction.amount.toNumber();
                
                await tx.account.update({
                    where:{id : transaction.accountId},
                    data:{balance:{increment: balanceChange} },
                });

                //Update last processed date and next recurring date
                await tx.transaction.update({
                    where: {id:transaction.id},
                    data: {
                        lastProcessed: new Date(),
                        nextRecurringDate: calculateNextRecurringDate(
                            new Date(),
                            transaction.recurringInterval
                        ),
                    },
                });
            });
        });
    }
);

function isTransactionDue(transaction){
    // If no lastProcessed date, transaction is due
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  // Compare with nextDue date
  return nextDue <= today;
}

// Helper function 
function calculateNextRecurringDate(startDate, interval){
    const date = new Date(startDate);

    switch(interval){
        case "DAILY":
            date.setDate(date.getDate() + 1);
            break;
        case "WEEKLY":
            date.setDate(date.getDate() + 7);
            break;
        case "MONTHLY":
            date.setMonth(date.getMonth() + 1);
            break;
        case "YEARLY":
            date.setFullYear(date.getFullYear() + 1);
            break;
    }

    return date;
}
