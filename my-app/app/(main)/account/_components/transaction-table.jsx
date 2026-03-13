"use client";

import React, { useEffect, useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,

} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { categoryColors } from '@/data/categories';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Clock, MoreHorizontal, RefreshCcw, Search, Trash, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import useFetch from '@/hooks/use-fetch';
import { bulkDeleteTransactions } from '@/actions/account';
import { toast } from 'sonner';
import { BarLoader } from 'react-spinners';

const RECURRING_INTERVALS = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};
const TransactionTable = ({transactions}) => {

    const router = useRouter();
    const [selectedIds,setSelectedIds] = useState([]);
    const [sortConfig,setSortConfig] = useState({
        feild:"date",
        direction:"desc",
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [recurringFilter, setRecurringFilter] = useState("");



  // this useMemo call back fucntion only runs when the dependencis in array change 
  // else it will cache the value of whatever it is getting inside of it
  // this code will not return us a function it will return us a final value 
    const filteredAndSortedTransactions = useMemo(()=>{
        let result = [...transactions]

        // Apply Search Filter
        if(searchTerm){
            const searchLower = searchTerm.toLowerCase();
            result = result.filter((transaction) =>
                transaction.description ?.toLowerCase().includes(searchLower)
        );
        }

        // Apply recurring Filter

        if(recurringFilter){
            result = result.filter((transaction)=>{
                if(recurringFilter === "recurring") 
                    return transaction.isRecurring;
            });
        }

        // Apply type Filter
         if(typeFilter){
            result = result.filter((transaction)=> transaction.type === typeFilter);
         }
        
        // Apply Sorting

       result.sort((a, b) => {
        let comparison = 0;

        switch (sortConfig.feild) {
            case "date":
            comparison = new Date(a.date) - new Date(b.date);
            break;
            case "Amount":
            comparison = a.amount - b.amount;
            break;
            case "Category":
            comparison = a.category.localeCompare(b.category);
            break;
            default:
            comparison = 0;
        }

        return sortConfig.direction === "asc" ? comparison : -comparison;
        });
        return result;
    },[
        transactions,
        searchTerm,
        typeFilter,
        recurringFilter,
        sortConfig,
    ]); 
    //when we are writing the logic of filter and sort our transaction we are going to keep it inside a function like the logic of whole inside the function
    // this is just refrencing the transactions in other variable 
    // yaha pe ham sorting and filter ka logic laga raha hoo iska matlab hai ham joh transaction ki array hai joh props se aa rahi hai usme direct mutate karne jaaynge toh dikkat hai issi liye hamne yeh sab refrnce liya hai 
    // taaki code naa faate;
    const handleSort = (feild)=>{
        setSortConfig(current =>({
            feild,
            direction:current.feild == feild && current.direction =="asc" ? "desc" :"asc",
        }))
    };

    // handle select fuction ko ham onclik karke laga deta hai on check box and yeh voh jaha pe run hoga 
    // voh id pass hua yeh ussi ki id ko leh lega issi liye yeh voh capture kar paayega 
    // yaha pe current latest state ko batana ke liye hai 
    // ...current means:“purani list ke saare IDs copy kar do”


    const handleSelect = (id)=>{
        setSelectedIds((current)=>
            current.includes(id)
        ?current.filter(item=>item!=id):
        [...current,id]
    );
    };

    const handleSelectAll = ()=>{
        setSelectedIds((current)=>
        current.length === filteredAndSortedTransactions.length
        ?[]:
        filteredAndSortedTransactions.map((t) =>t.id)
    );
    };

    const {
        loading:deleteLoading,
        fn:deleteFn,
        data:deleted,
    } = useFetch(bulkDeleteTransactions);
    const handleBulkDelete = async ()=>{
        if(!window.confirm(
            `Are you sure you want to delete ${selectedIds.length} transactions`
        )
    ){
        return;
    } 
     deleteFn(selectedIds);
    };

    useEffect(()=>{
        if(deleted && !deleteLoading){
            toast.error("Transaction Deleted Successfully");
        }
    },[deleted,deleteLoading]);


    // isse kuch nahi hoga isse yeh hoga ki joh bhi select hua hai voh sab 
    // uski bahri hui aary ko vapas empty maar dega jisse hamko ui meh kuch nahi dekhega
    const handleClearFilter = ()=>{
        setSearchTerm("");
        setTypeFilter("");
        setRecurringFilter("");
        setSelectedIds([]);
    };
  return (
    <div className="space-y-4">
    {/* while deleting is going on we want to show a loading indicator*/}
    {deleteLoading && <BarLoader className="mt-4 " width={"100%"} color ="#9333ea"/>}
    {/*Filters */}
    <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder = "Search Transactions .."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              //setCurrentPage(1);
            }}
            className="pl-8"
          />
        </div>
        
        <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
            </Select>

            <Select 
            value={recurringFilter} 
            onValueChange={(value) => setRecurringFilter(value)}>
                <SelectTrigger className="w-150px">
                    <SelectValue placeholder="All Transactions" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="recurring">Recuuring Only</SelectItem>
                    <SelectItem value="non-recurring">Non-Recurring Only</SelectItem>
                </SelectContent>
            </Select>

            {selectedIds.length >0 && (
                <div className="flex item-center gap-2">
                    <Button variant = "destructive" size="sm" onClick ={handleBulkDelete}>
                        <Trash className="h-4 w-4 mr-2"/>
                        Delete Selected({selectedIds.length})
                    </Button>
                </div>
            )}

            {(searchTerm || typeFilter || recurringFilter) && (
                <Button variant= "outline" size="icon" onClick={handleClearFilter}
                title="Clear Filters">
                    <X className="h-4 w-5" />
                </Button>
            )}
        </div>
    </div>
    
    {/*Transactions*/}
    <div className="rounded-md border">
    <Table>
    <TableHeader>
        <TableRow>
        <TableHead className="w-50px">
            <Checkbox 
            onCheckedChange = {handleSelectAll}
            checked = {
                selectedIds.length ===
                filteredAndSortedTransactions.length &&
                filteredAndSortedTransactions.length >0
            }
            />
        </TableHead>
         <TableHead className="cursor-pointer"
         onClick={()=>handleSort("date")}
         >
            <div className="flex items-center">Date

            {sortConfig.feild ==="date" && 
            (sortConfig.direction ==="asc"?(
                <ChevronUp className="ml-1 h-4 w-4"/>
            ):(
                <ChevronDown className="ml-1 h-4 w-4"/>
            ))}
            </div>
        </TableHead>
        <TableHead>Description</TableHead>
        <TableHead className="cursor-pointer"
         onClick={()=>handleSort("Category")}
         >
            <div className="flex items-center">Category

                {sortConfig.feild ==="Category" && 
                (sortConfig.direction ==="asc"?(
                    <ChevronUp className="ml-1 h-4 w-4"/>
                ):(
                    <ChevronDown className="ml-1 h-4 w-4"/>
                ))}
            </div>
        </TableHead>

        <TableHead className="cursor-pointer"
         onClick={()=>handleSort("Amount")}
         >
            <div className="flex items-center justify-end">Amount

                        {sortConfig.feild ==="Amount" && 
                    (sortConfig.direction ==="asc"?(
                        <ChevronUp className="ml-1 h-4 w-4"/>
                    ):(
                        <ChevronDown className="ml-1 h-4 w-4"/>
                    ))}
            </div>
        </TableHead>
        <TableHead>Recurring</TableHead>
        <TableHead className="w-50px"/>
        </TableRow>
    </TableHeader>
    <TableBody>
        {filteredAndSortedTransactions.length === 0?(
            <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No transaction Found
                </TableCell>
            </TableRow>
        ) : (
            filteredAndSortedTransactions.map((transaction)=>(
                <TableRow key={transaction.id}>
                    <TableCell >
                        <Checkbox onCheckedChange={()=>handleSelect(transaction.id)}
                        checked = {selectedIds.includes(transaction.id)} />
                    </TableCell>
                    <TableCell>{format(new Date(transaction.date),"PP")}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell className="capitalize">
                        <span style={{
                            background:categoryColors[transaction.category],
                        }}
                        className="px-2 py-1 rounded text-white text-sm"
                        >{transaction.category}</span>
                    </TableCell>
                        
                    <TableCell className="text-right font-medium"
                        style={{
                            color:transaction.type=="EXPENSE"?"red":"green",
                        }}
                    >
                        {transaction.type=="EXPENSE" ? "-":"+"}
                        ₹{transaction.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                        {transaction.isRecurring ?(
                            <Tooltip>
                                <TooltipTrigger>
                                <Badge variant="outline" className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200">
                                <RefreshCcw className="h-3 w-3"/>
                                 {
                                 RECURRING_INTERVALS
                                 [transaction.recurringInterval]
                                 }
                                </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="text-sm">
                                        <div className="font-medium">Next Date:</div>
                                        <div>
                                            {format(new Date(transaction.nextRecurringDate),"PP")}
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        ):(
                            <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3"/>
                                One-time
                            </Badge>
                        )}
                    </TableCell>

                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                onClick={()=>
                                    router.push(
                                        `/transaction/create?edit=${transaction.id}`
                                    )
                                }
                                >Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive"
                                    onClick={() =>deleteFn([transaction.id])}
                                >Delete</DropdownMenuItem>

                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                </TableRow>
            ))
        
        )}
    </TableBody>
    </Table>
    </div>
    </div>
  )
}

export default TransactionTable;
