"use server";
// this is the server action for creating a transactions
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { request } from "@arcjet/next";
import aj from "@/lib/arcjet";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { success } from "zod";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const serilzeAmount = (obj) => ({
    ...obj,
    amount:obj.amount.toNumber(),
});

// Create Transaction
export async function createTransaction(data) {
    try {
        const {userId} = await auth();
        if(!userId) throw new Error("Unauthorized");

        // adding some limitations on how much transaction a user can add a day 
        // otherwise this thing will break our code if user (bot) create 1000 transactions a day
        // Arcjet to add rate limiting 
        const req = await request();

        // check rate limit
        const decision = await aj.protect(req,{
            userId,
            requested: 1, // specify how many tokens to consuem 
        });

        const user = await db.user.findUnique({
            where: {clerkUserId: userId},
        });

        if(decision.isDenied()){
            if(decision.reason.isRateLimit()){
                const {remaining, reset} = decision.reason;
                console.error({
                    code: "RATE_LIMIT_EXCEEDED",
                    details:{
                        remaining,
                        resetInSeconds: reset,
                    },
                });

                throw new Error ("Too many request. please try again later");

            }
            throw new Error ("Request denied");
        }
    
        if(!user) throw new Error("User not found");
    
        const account = await db.account.findUnique({
            where:{
                id: data.accountId,
                userId: user.id,
            },
        });

        if(!account){
            throw new Error("Account not found");
        }

        const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
        const newBalance = account.balance.toNumber() + balanceChange;

        // this is prisma transcation 
        // reserved key word in prisma and it is a callback 

        const transaction  = await db.$transaction(async (tx) => {
            const newTransaction = await tx.transaction.create({
                data:{
                    ...data,
                    userId: user.id,
                    nextRecurringDate: data.isRecurring && data.recurringInterval 
                    ? calculateNextRecurringDate(data.date,data.recurringInterval)
                    :null,
                },
            });

            await tx.account.update({
                where:{id:data.accountId},
                data:{balance: newBalance},
            })

            return newTransaction;
        });

        revalidatePath("/dashboard");
        revalidatePath(`/account/${transaction.accountId}`);

        return {success: true, data: serilzeAmount(transaction)};
    } catch (error) {
        throw new Error(error.message);
    }
}

// helper function to calculate next recurring date
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

// new server action to scan recipt using Gemini Ai 


// file is the input from the user 
// it will be a recipt 
// obv we will provide the check if it image or anything else we will not provide this on server site it will be checked on client site 
export async function ScanReceipt(formData){
    try {
        const file = formData.get("file");
        if (!file) throw new Error("No file received");
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite"
        });

        // Convert File to ArrayBuffer
        // we have taken this file from user so we have to convert this file in arrayBuffer so that we can provide this to the model 
        const arrayBuffer = await file.arrayBuffer();

        // Convert ArrayBuffer to Base64
        //its a type of image we can use to store in our database so that we can provide it our Ai model 
        const base64String = Buffer.from(arrayBuffer).toString("base64");   
        const prompt =`
            Analyze this receipt image and extract the following information in JSON format:

                {
                "amount": number,
                "date": "ISO date string",
                "description": "string",
                "merchantName": "string",
                "category": "string"
                }

            If it is not a receipt, return {}Analyze this receipt image and extract the following information in JSON format:
            - Total amount (just the number)
            - Date (in ISO format)
            - Description or items purchased (brief summary)
            - Merchant/store name
            - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense )
            
            Only respond with valid JSON in this exact format:
            {
                "amount": number,
                "date": "ISO date string",
                "description": "string",
                "merchantName": "string",
                "category": "string"
            }

            If its not a recipt, return an empty object
        `;

        const result = await model.generateContent([
        {
            inlineData: {
            data: base64String,
            mimeType: file.type,
            },
        },
        prompt,
        ]);

        const text = result.response.text();
        // this text have some figure like  /```JSON a xuhbAUXB JSON```/ so we have to remove thsi json and slash and need on clean text btw it 
        const cleanedtext = text.replace(/```(?:json)?\n?/g, "").trim();
        const data = JSON.parse(cleanedtext);

        return {
        amount: Number(data.amount),
        date: data.date,
        description: data.description,
        category: data.category,
        merchantName: data.merchantName,
        };
        
        } catch (error) {
         console.error("Error Receipt scan failed:",error);
        throw new Error("Failed to scan receipt");
        
    }   
}

// server action to edit the transaction 

export async function getTransaction(id){
    const {userId} = await auth();
    if(!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: {clerkUserId: userId},
    });
    
    if(!user) throw new Error("User not found");

    // code to fectch the transaction 
    const transaction = await db.transaction.findUnique({
        where : {
            id,
            userId:user.id,
        },
    });

    if(!transaction) throw new Error("Transaction not Found");

    return serilzeAmount(transaction);
}

export async function updateTransaction(id,data){
    try {
    const {userId} = await auth();
    if(!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
        where: {clerkUserId: userId},
    });
    
    if(!user) throw new Error("User not found");

    // Get original transaction to calculate balance change 
    const originalTransaction = await db.transaction.findUnique({
        where:{
            id,userId: user.id,
        },
        include:{
            account:true,
        },
    });

    if(!originalTransaction)  throw new Error("Transaction not Found");

    // calculate balance changes 
    const oldBalanceChange =
        originalTransaction.type === "EXPENSE"
        ?-originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

        const newBalanceChange = data.type ==="EXPENSE"?-data.amount:data.amount;

        const netBalanceChange = newBalanceChange - oldBalanceChange;

        // again prisma transaction 
        // update transcation and account balance in a transcation 
        const transaction = await db.$transaction(async(tx)=>{
            const updated = await tx.transaction.update({
                where:{
                    id,
                    userId:user.id,
                },
                data:{
                    ...data,
                    nextRecurringDate:
                        data.isRecurring && data.recurringInterval 
                            ? calculateNextRecurringDate(data.date,data.recurringInterval) 
                            :null,
                },
            });

            // update account balance 
            await tx.account.update({
                where:{
                    id:data.accountId
                },
                data:{
                    balance :{
                        increment: netBalanceChange,
                    },
                },
            });

            return updated;
        });

        revalidatePath("/dashboard");
        revalidatePath(`/account/${data.accountId}`);

        return {success: true, data:serilzeAmount (transaction) };
    } catch (error) {
        throw new Error (error.message);
    }
}