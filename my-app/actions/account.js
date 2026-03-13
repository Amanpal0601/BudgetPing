"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { success } from "zod";
const serializeTransaction = (obj) => {
  const serialized = { ...obj };
  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }

  if (obj.amount) {
    serialized.amount = obj.amount.toNumber();
  }

  return serialized;
};

export async function updateDefaultAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // First, unset any existing default account
    await db.account.updateMany({
      where: {
        userId: user.id,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Then set the new default account
    const account = await db.account.update({
      where: {
        id: accountId,
        userId: user.id,
      },
      data: { isDefault: true },
    });

    revalidatePath("/dashboard");
    return { success: true, data: serializeTransaction(account) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// we will create our server action to get the accounts details

export async function getAccountWithTransactions(accountId) {
  if (!accountId) return null;

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const account = await db.account.findFirst({
    where: {
      id: accountId,
      userId: user.id,
    },
    include: {
      transactions: {
        orderBy: { date: "desc" }, // ⚠ ensure field name
      },
      _count: {
        select: { transactions: true },
      },
    },
  });

  if (!account) return null;

  return {
    ...serializeTransaction(account),
    transactions: account.transactions.map(serializeTransaction),
  };
}

// server action to bulk delete option 

export async function bulkDeleteTransactions(transactionIds){
  try {
    const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }
    const transactions = await db.transaction.findMany({
      where: {
        id: {in:transactionIds},
        userId: user.id,
      },
    });

    const accountBalanceChanges = transactions.reduce((acc,transaction)=>{
      const change=
        transaction.type === "EXPENSE"
        ? transaction.amount
        :-transaction.amount;

        acc[transaction.accountId] = (acc[transaction.accountId] || 0) + change;
        return acc;
    },{});

    // Delete transaction and update account balance in a transaction
    // when you have to perform multiple API  call and need to make sure that none of the api call fails
    // for these cases we have something called tranasaction in prisma 
    // this is the transaction key words which help uss in many ways to not fails while doing multiple API calls 

    await db.$transaction(async (tx) =>{
      // Delete Transactions
      await tx.transaction.deleteMany({
        where: {
          id: {in: transactionIds},
          userId :user.id,
        },
      });

      for(const [accountId,balanceChange] of Object.entries(
        accountBalanceChanges
      )){
        await tx.account.update({
          where :{ id:accountId},
          data: {
            balance: {
              increment:balanceChange
            },
          },
        });
      }
    });
    
    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");

    return {success:true};
  } catch (error) {
    return {success:false,error:error.message};
  }
}
