"use client";

import { ScanReceipt } from '@/actions/transaction';
import { Button } from '@/components/ui/button';
import useFetch from '@/hooks/use-fetch';
import { Camera, Loader2 } from 'lucide-react';
import React, { useEffect, useRef } from 'react'
import { toast } from 'sonner';

const ReciptScanner = ({onScanComplete}) => {
    const fileInputRef = useRef(null);

    const {
        loading : scanReceiptLoading,
        fn: ScanReceiptFn,
        data:scannedData,
    }= useFetch(ScanReceipt);

    const handleReceiptScan = async(file) =>{
        if(file.size > 5 * 1024 * 1024){
            toast.error("file size should be less than 5MB");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const scannedData = await ScanReceipt(formData);
            onScanComplete(scannedData);
            toast.success("Receipt scanned successfully");
        } catch (err) {
            toast.error("Failed to scan receipt");
        }
    };

    useEffect(()=>{
        if(scannedData && !scanReceiptLoading){
            onScanComplete(scannedData);
            toast.success("Receipt scanned Succeddfully");
        }
    },[scanReceiptLoading,scannedData]);
  return (
    <div className ="flex item-center gap-4">
      <input 
      type="file" 
      ref={fileInputRef}
      className="hidden"
      accept="image/*"
      capture="environment"

      onChange={(e)=>{
        const file =e.target.files?.[0];
        if(file) handleReceiptScan(file);
      }}
      />

      <Button 
      type="button"
      variant='outline'
      className="w-full h-10 bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-500 animate-gradient hover:opacity-90 transition-opacity text-white hover:text-white"
      onClick={(e) => {
        fileInputRef.current?.click();
    }}
      disabled = {scanReceiptLoading}
      
      >{scanReceiptLoading ? ( 
        <>
            <Loader2 className= "mr-2 animate-spin"/>
            <span>Scanning Receipt...</span>
        </>
        ) : (
        <>
            <Camera className ="mr-2"/>
            <span>Scan Receipt with AI</span>

        </>
        )}
     </Button>
    </div>
  )
}

export default ReciptScanner;
