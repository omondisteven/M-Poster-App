import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect, } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, GithubIcon, LockIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { motion } from "framer-motion";
import { ColorPicker } from "@/components/ui/color-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import templates from "@/data/templates.json";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createRoot } from 'react-dom/client';
import QrSvg from "@wojtekmaj/react-qr-svg";
import { generateQRCode } from "@/utils/helpers";
import { useAppContext,  } from "@/context/AppContext";
import { TRANSACTION_TYPE } from "@/@types/TransactionType";
// import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AsYouType } from 'libphonenumber-js';

// Define zod schema for validation
const formSchema = z.object({
  type: z.nativeEnum(TRANSACTION_TYPE),
  selectedColor: z.string(),
  showName: z.boolean(),
  title: z.string().min(1, "Title cannot be empty"),
  phoneNumber: z.string().refine((value) => {
    // Allow empty string (optional)
    if (!value) return true;
    
    // Remove all characters except digits, + and spaces
    const cleaned = value.replace(/[^\d+ ]/g, '');
    
    // Must contain only numbers, spaces and optional leading +
    const isValidFormat = /^\+?[\d ]+$/.test(cleaned);
    
    // Must have at least 10 digits (excluding + and spaces)
    const digitCount = cleaned.replace(/[^0-9]/g, '').length;
    const hasMinDigits = digitCount >= 10;
    
    return isValidFormat && hasMinDigits;
  }, {
    message: ""
  }).optional().or(z.literal('')),
  name: z.string().optional().or(z.literal('')),
  paybillNumber: z.string().optional().or(z.literal('')),
  paybillNumberLabel: z.string().optional(),
  accountNumber: z.string().optional().or(z.literal('')),
  accountNumberLabel: z.string().optional(),
  tillNumber: z.string().optional().or(z.literal('')),
  tillNumberLabel: z.string().optional(),
  agentNumber: z.string().optional().or(z.literal('')),
  agentNumberLabel: z.string().optional(),
  storeNumber: z.string().optional().or(z.literal('')),
  storeNumberLabel: z.string().optional(), 
})
  .superRefine((data, ctx) => {
    // Name is only required when showName is true
    if (data.showName && !data.name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "",
        path: ["name"],
      });
    }

    // Validate based on transaction type
    switch (data.title) {
      case "Send Money":
        if (!data.phoneNumber?.trim() || data.phoneNumber.trim().length < 10) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["phoneNumber"],
          });
        }
        break;
      
      case "Pay Bill":
        if (!data.paybillNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["paybillNumber"],
          });
        }
        if (!data.accountNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["accountNumber"],
          });
        }
        break;
      
      case "Buy Goods":
        if (!data.tillNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["tillNumber"],
          });
        }
        break;
      
      case "Withdraw Money":
        if (!data.agentNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["agentNumber"],
          });
        }
        if (!data.storeNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["storeNumber"],
          });
        }
        break;
    }
    // Update validation to use TRANSACTION_TYPE
    switch (data.type) {
      case TRANSACTION_TYPE.SEND_MONEY:
        if (!data.phoneNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["phoneNumber"],
          });
        }
        break;
      
      case TRANSACTION_TYPE.PAYBILL:
        if (!data.paybillNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["paybillNumber"],
          });
        }
        if (!data.accountNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["accountNumber"],
          });
        }
        break;
      
      case TRANSACTION_TYPE.TILL_NUMBER:
        if (!data.tillNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["tillNumber"],
          });
        }
        break;
      
      case TRANSACTION_TYPE.AGENT:
        if (!data.agentNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["agentNumber"],
          });
        }
        if (!data.storeNumber?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "",
            path: ["storeNumber"],
          });
        }
        break;
    }
  });

// Define form type
interface FormValues {
  type: TRANSACTION_TYPE;
  selectedColor: string;
  showName: boolean;
  title: string;
  phoneNumber?: string;
  name?: string;
  paybillNumber?: string;
  paybillNumberLabel?: string;
  accountNumber?: string;
  accountNumberLabel?: string;
  tillNumber?: string;
  tillNumberLabel?: string;
  agentNumber?: string;
  agentNumberLabel?: string;
  storeNumber?: string;
  storeNumberLabel?: string;
}

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [qrGenerationMethod, setQrGenerationMethod] = useState<"mpesa" | "push">("push");
  const [previewQrData, setPreviewQrData] = useState("");

  const { data } = useAppContext();
  const posterRef = useRef<HTMLDivElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);

  const { control, handleSubmit, watch, setValue, formState: { errors, isValid }, trigger } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: TRANSACTION_TYPE.SEND_MONEY,
      selectedColor: "#16a34a",
      showName: false,
      title: "Send Money",
      phoneNumber: data.phoneNumber || "",
      name: data.name || "",
      paybillNumber: data.paybillNumber || "",
      paybillNumberLabel: "Business Number",
      accountNumber: data.accountNumber || "",
      accountNumberLabel: "Account Number",
      tillNumber: data.tillNumber || "",
      tillNumberLabel: "Till Number",
      agentNumber: data.agentNumber || "",
      agentNumberLabel: "Agent Number",
      storeNumber: data.storeNumber || "",
      storeNumberLabel: "Store Number",
    },
    mode: "onChange",
  });
  
  const phoneNumber = watch("phoneNumber");
  const name = watch("name");
  const selectedColor = watch("selectedColor");
  const showName = watch("showName");
  const title = watch("title");
  const paybillNumber = watch("paybillNumber");
  const accountNumber = watch("accountNumber");
  const tillNumber = watch("tillNumber");
  const agentNumber = watch("agentNumber");
  const storeNumber = watch("storeNumber");
  const paybillNumberLabel = watch("paybillNumberLabel");
  const accountNumberLabel = watch("accountNumberLabel");
  const tillNumberLabel = watch("tillNumberLabel");
  const agentNumberLabel = watch("agentNumberLabel");
  const storeNumberLabel = watch("storeNumberLabel");

  // Sync form values with context
  useEffect(() => {
    setValue("paybillNumber", data.paybillNumber);
    setValue("accountNumber", data.accountNumber);
    setValue("tillNumber", data.tillNumber);
    setValue("agentNumber", data.agentNumber);
    setValue("storeNumber", data.storeNumber);
    setValue("phoneNumber", data.phoneNumber);
  }, [data, setValue]);

  // Add this useEffect to update the preview QR data
  useEffect(() => {
    const updatePreviewQr = async () => {
      const formData = {
        type: watch("type"),
        phoneNumber: watch("phoneNumber"),
        paybillNumber: watch("paybillNumber"),
        accountNumber: watch("accountNumber"),
        tillNumber: watch("tillNumber"),
        agentNumber: watch("agentNumber"),
        storeNumber: watch("storeNumber"),
      };
  
      if (qrGenerationMethod === "mpesa") {
        setPreviewQrData(generateQRCode(formData) || "");
      } else {
        // For preview, create the same structure but don't make API calls
        let qrData = {};
        switch (formData.type) {
          case TRANSACTION_TYPE.SEND_MONEY:
            qrData = {
              TransactionType: "SendMoney",
              RecepientPhoneNumber: formData.phoneNumber,
              PhoneNumber: "254"
            };
            break;
          case TRANSACTION_TYPE.PAYBILL:
            qrData = {
              TransactionType: "PayBill",
              PaybillNumber: formData.paybillNumber,
              AccountNumber: formData.accountNumber,
              PhoneNumber: "254"
            };
            break;
          case TRANSACTION_TYPE.TILL_NUMBER:
            qrData = {
              TransactionType: "BuyGoods",
              TillNumber: formData.tillNumber,
              PhoneNumber: "254"
            };
            break;
          case TRANSACTION_TYPE.AGENT:
            qrData = {
              TransactionType: "WithdrawMoney",
              AgentId: formData.agentNumber,
              StoreNumber: formData.storeNumber,
              PhoneNumber: "254"
            };
            break;
        }
        
        const encodedData = encodeURIComponent(JSON.stringify(qrData));
        setPreviewQrData(`http://e-biz-mpesa-payment-app.vercel.app/QrResultsPage?data=${encodedData}`);
      }
    };
  
    updatePreviewQr();
  }, [qrGenerationMethod, watch("type"), watch("phoneNumber"), watch("paybillNumber"), 
      watch("accountNumber"), watch("tillNumber"), watch("agentNumber"), watch("storeNumber")]);  
   
      const generateDownloadQrData = async (): Promise<string> => {
        const formData = {
          type: watch("type"),
          phoneNumber: watch("phoneNumber"),
          paybillNumber: watch("paybillNumber"),
          accountNumber: watch("accountNumber"),
          tillNumber: watch("tillNumber"),
          agentNumber: watch("agentNumber"),
          storeNumber: watch("storeNumber"),
        };
      
        if (qrGenerationMethod === "mpesa") {
          return generateQRCode(formData) || "";
        } else {
          try {
            // Create the QR data object based on transaction type
            let qrData = {};
            switch (formData.type) {
              case TRANSACTION_TYPE.SEND_MONEY:
                qrData = {
                  TransactionType: "SendMoney",
                  RecepientPhoneNumber: formData.phoneNumber,
                  PhoneNumber: "254" // Default phone number prefix
                };
                break;
              case TRANSACTION_TYPE.PAYBILL:
                qrData = {
                  TransactionType: "PayBill",
                  PaybillNumber: formData.paybillNumber,
                  AccountNumber: formData.accountNumber,
                  PhoneNumber: "254"
                };
                break;
              case TRANSACTION_TYPE.TILL_NUMBER:
                qrData = {
                  TransactionType: "BuyGoods",
                  TillNumber: formData.tillNumber,
                  PhoneNumber: "254"
                };
                break;
              case TRANSACTION_TYPE.AGENT:
                qrData = {
                  TransactionType: "WithdrawMoney",
                  AgentId: formData.agentNumber,
                  StoreNumber: formData.storeNumber,
                  PhoneNumber: "254"
                };
                break;
            }
      
            const encodedData = encodeURIComponent(JSON.stringify(qrData));
            const originalUrl = `http://e-biz-mpesa-payment-app.vercel.app/QrResultsPage?data=${encodedData}`;
      
            // Create TinyURL
            const response = await fetch(`https://api.tinyurl.com/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer QeiZ8ZP85UdMKoZxaDDo2k8xuquZNXT6vys45A1JImuP4emSxSi2Zz655QDJ',
              },
              body: JSON.stringify({
                url: originalUrl,
                domain: "tiny.one",
              }),
            });
      
            const result = await response.json();
            if (result.data?.tiny_url) {
              return result.data.tiny_url;
            }
            return originalUrl; // Fallback to full URL if TinyURL fails
          } catch (error) {
            console.error("Error creating TinyURL:", error);
            // Fallback to Mpesa QR if TinyURL fails
            return generateQRCode(formData) || "";
          }
        }
      };

  // Add this effect to trigger validation when title changes
  useEffect(() => {
    // Reset validation for all fields
    trigger();
    
    // Clear fields that aren't relevant for the current transaction type
    if (title !== "Send Money") {
      setValue("phoneNumber", "");
    }
    if (title !== "Pay Bill") {
      setValue("paybillNumber", "");
      setValue("accountNumber", "");
    }
    if (title !== "Buy Goods") {
      setValue("tillNumber", "");
    }
    if (title !== "Withdraw Money") {
      setValue("agentNumber", "");
      setValue("storeNumber", "");
    }
  }, [title, setValue, trigger]);

  const colorOptions = [
    { name: "Green", value: "#16a34a", class: "bg-green-600" },
    { name: "Rose", value: "#be123c", class: "bg-rose-700" },
    { name: "Yellow", value: "#F7C50C", class: "bg-[#F7C50C]" },
    { name: "Blue", value: "#1B398E", class: "bg-blue-800" },
  ];

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters except leading + and spaces
    const cleanedValue = value.replace(/[^\d+ ]/g, '');
    
    // Use AsYouType formatter for real-time formatting
    const formatter = new AsYouType();
    
    // Feed the input character by character to get proper formatting
    cleanedValue.split('').forEach(char => formatter.input(char));
    
    // Get the formatted number
    const formattedNumber = formatter.getNumber();
    
    if (formattedNumber) {
      // Return in national format if it's a local number (starts with 0)
      if (formattedNumber.number.startsWith('+2540')) {
        return formattedNumber.formatNational();
      }
      // Return in international format if it's a full international number
      return formattedNumber.formatInternational();
    }
    
    // Fallback - return the cleaned value with preserved spaces
    return cleanedValue;
  };

  const onSubmit = handleSubmit(async () => {
    await handleDownload();
  });

  const handleDownload = async () => {
    if (!posterRef.current) return;
  
    try {
      await document.fonts.load("bold 120px Inter");
  
      const canvas = document.createElement('canvas');
      const width = selectedTemplate.size.width;
      const posterHeight = selectedTemplate.size.height;
      const qrCodePadding = 40;
      const qrCodeWidth = width - (qrCodePadding * 2);
      
      // Calculate section count based on title and showName
      let sectionCount = 2; // Default to 2 sections
      if (title === "Pay Bill" || title === "Withdraw Money") {
        sectionCount = 3; // Title + 2 fields
      }
      if (showName) {
        sectionCount += 1; // Add name section
      }
      
      const sectionHeight = posterHeight / sectionCount;
      
      // QR code section height (scan section + QR code + padding)
      const scanTextFontSize = Math.round(qrCodeWidth * 0.06);
      const scanSectionHeight = sectionHeight;
      const qrSectionHeight = qrCodeWidth + scanSectionHeight + 70;
      
      const borderSize = 8;
      const totalHeight = posterHeight + qrSectionHeight + borderSize;
      
      canvas.width = width;
      canvas.height = totalHeight;
  
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Unable to get canvas context");
        return;
      }
  
      // Colors
      const mainColor = selectedColor;
      const borderColor = "#1a2335";
      const whiteColor = "#ffffff";
      const textColor = "#000000";
  
      // Draw outer border for the entire canvas
      ctx.fillStyle = borderColor;
      ctx.fillRect(0, 0, width, totalHeight);    

      // QR Code Section - NOW AT THE TOP
      const qrSectionY = 0;

      // Draw white background for QR code section
      ctx.fillStyle = whiteColor;
      ctx.fillRect(
        borderSize,
        qrSectionY + borderSize,
        width - 2 * borderSize,
        qrSectionHeight - borderSize
      );

      // Create scan section with same height as other sections
      const scanSectionY = qrSectionY + borderSize;
      
      // Draw main color background for scan section (changed from gray to mainColor)
      ctx.fillStyle = mainColor;
      ctx.fillRect(
        borderSize,
        scanSectionY,
        width - 2 * borderSize,
        scanSectionHeight
      );
      
      // Add border between scan section and QR code
      ctx.fillStyle = borderColor;
      ctx.fillRect(
        borderSize,
        scanSectionY + scanSectionHeight,
        width - 2 * borderSize,
        borderSize
      );

      // Add bottom border to QR code section
      ctx.fillStyle = borderColor;
      ctx.fillRect(
        borderSize,
        scanSectionY + qrSectionHeight - borderSize,
        width - 2 * borderSize,
        borderSize
      );

      // Add "SCAN TO PAY!" text in the scan section (changed text color to white)
      const scanText = "SCAN TO PAY!";
      ctx.fillStyle = whiteColor; // Changed from textColor to whiteColor
      ctx.font = `bold ${scanTextFontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        scanText, 
        width / 2, 
        scanSectionY + (scanSectionHeight / 2)
      );

      // Position QR code below the scan section
      const qrCodeY = scanSectionY + scanSectionHeight + borderSize + 30;

      // Draw sections with proper colors and borders (shifted down by qrSectionHeight)
      for (let i = 0; i < sectionCount; i++) {
        const yPos = i * sectionHeight + qrSectionHeight + borderSize;
        let currentSectionHeight = sectionHeight;
        
        // Adjust for top border on first section
        if (i === 0) {
          currentSectionHeight = sectionHeight - borderSize;
        }
        // Adjust for bottom border on last section
        else if (i === sectionCount - 1) {
          currentSectionHeight = sectionHeight - borderSize;
        }
        
        // Determine section color
        let sectionColor;
        if (i === 0) {
          sectionColor = mainColor; // First section is always main color
        } else {
          // Alternate between white and main color
          sectionColor = i % 2 === 0 ? mainColor : whiteColor;
        }
        
        ctx.fillStyle = sectionColor;
        ctx.fillRect(
          borderSize,
          yPos,
          width - 2 * borderSize,
          currentSectionHeight
        );
        
        // Draw top border for all sections except the first one
        if (i > 0) {
          ctx.fillStyle = borderColor;
          ctx.fillRect(
            borderSize,
            yPos - borderSize,
            width - 2 * borderSize,
            borderSize
          );
        }
      }
  
      // Set text properties
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
  
      // Font sizes
      const titleFontSize = Math.round(Math.min(width, posterHeight) * 0.1);
      const labelFontSize = Math.round(Math.min(width, posterHeight) * 0.06);
      const valueFontSize = Math.round(Math.min(width, posterHeight) * 0.15);
      const tillValueFontSize = Math.round(Math.min(width, posterHeight) * 0.2);
      const nameFontSize = Math.round(Math.min(width, posterHeight) * 0.1);
  
      // Draw Title text (always in first section)
      const titleSectionY = qrSectionHeight + borderSize;
      ctx.fillStyle = whiteColor;
      ctx.font = `bold ${titleFontSize}px Inter, sans-serif`;
      ctx.fillText(title.toUpperCase(), width / 2, titleSectionY + (sectionHeight / 2));
  
      // Draw content based on transaction type
      switch (title) {
        case "Send Money":
          // Phone number in second section
          ctx.fillStyle = textColor;
          ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
          ctx.fillText(
            phoneNumber || "0722 256 123",
            width / 2,
            titleSectionY + sectionHeight + (sectionHeight / 2)
          );
          break;
        
        case "Pay Bill":
          // Business Number (second section)
          ctx.fillStyle = textColor;
          ctx.font = `bold ${labelFontSize}px Inter, sans-serif`;
          ctx.fillText(
            paybillNumberLabel || "BUSINESS NUMBER", 
            width / 2, 
            titleSectionY + sectionHeight + (sectionHeight * 0.15)
          );
          
          ctx.fillStyle = textColor;
          ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
          ctx.fillText(
            paybillNumber || "12345", 
            width / 2, 
            titleSectionY + sectionHeight + (sectionHeight * 0.5)
          );
          
          // Account Number (third section)
          const accountNumberYPos = titleSectionY + (2 * sectionHeight) + (sectionHeight * 0.15);
          ctx.fillStyle = whiteColor;
          ctx.font = `bold ${labelFontSize}px Inter, sans-serif`;
          ctx.fillText(
            accountNumberLabel || "ACCOUNT NUMBER", 
            width / 2, 
            accountNumberYPos
          );
          
          ctx.fillStyle = whiteColor;
          ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
          ctx.fillText(
            accountNumber || "12345", 
            width / 2, 
            accountNumberYPos + (sectionHeight * 0.35)
          );
          break;
        
        case "Buy Goods":
          // Till Number (second section)
          ctx.fillStyle = textColor;
          ctx.font = `bold ${labelFontSize}px Inter, sans-serif`;
          ctx.fillText(
            tillNumberLabel || "TILL NUMBER", 
            width / 2, 
            titleSectionY + sectionHeight + (sectionHeight * 0.15)
          );
          
          ctx.fillStyle = textColor;
          ctx.font = `bold ${tillValueFontSize}px Inter, sans-serif`;
          ctx.fillText(
            tillNumber || "12345", 
            width / 2, 
            titleSectionY + sectionHeight + (sectionHeight * 0.5)
          );
          break;
        
        case "Withdraw Money":
          // Agent Number (second section)
          ctx.fillStyle = textColor;
          ctx.font = `bold ${labelFontSize}px Inter, sans-serif`;
          ctx.fillText(
            agentNumberLabel || "AGENT NUMBER", 
            width / 2, 
            titleSectionY + sectionHeight + (sectionHeight * 0.15)
          );
          
          ctx.fillStyle = textColor;
          ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
          ctx.fillText(
            agentNumber || "12345", 
            width / 2, 
            titleSectionY + sectionHeight + (sectionHeight * 0.5)
          );
          
          // Store Number (third section)
          const storeNumberYPos = titleSectionY + (2 * sectionHeight) + (sectionHeight * 0.15);
          ctx.fillStyle = whiteColor;
          ctx.font = `bold ${labelFontSize}px Inter, sans-serif`;
          ctx.fillText(
            storeNumberLabel || "STORE NUMBER", 
            width / 2, 
            storeNumberYPos
          );
          
          ctx.fillStyle = whiteColor;
          ctx.font = `bold ${valueFontSize}px Inter, sans-serif`;
          ctx.fillText(
            storeNumber || "12345", 
            width / 2, 
            storeNumberYPos + (sectionHeight * 0.35)
          );
          break;
      }
  
      // Draw name when showName is true (last section)
      if (showName) {
        const nameSectionIndex = sectionCount - 1;
        const nameYPos = qrSectionHeight + (nameSectionIndex * sectionHeight) + (sectionHeight / 2);
        const nameTextColor = nameSectionIndex % 2 === 0 ? whiteColor : textColor;
        
        ctx.fillStyle = nameTextColor;
        ctx.font = `bold ${nameFontSize}px Inter, sans-serif`;
        ctx.fillText(
          name?.toUpperCase() || "NELSON ANANGWE", 
          width / 2, 
          nameYPos
        );
      }

       // Generate QR code data - await the result
       const qrData = await generateDownloadQrData();
       if (!qrData) {
         throw new Error("Invalid QR code data");
       }

      // Create a temporary container for the QR code
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      // Create a root and render the QR code
      const root = createRoot(tempDiv);
        root.render(
          <QrSvg
            value={qrData} // Now this is definitely a string
            className="qr-code-svg"
            fgColor="#000000"
            style={{ width: qrCodeWidth, height: qrCodeWidth }}
          />
        );
      // Wait briefly for React to render
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get the SVG element
      const svgElement = tempDiv.querySelector('.qr-code-svg') as SVGSVGElement;
      if (!svgElement) {
        throw new Error("Could not generate QR code");
      }

      // Serialize the SVG
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
      });

      // Draw the QR code to the main canvas
      ctx.drawImage(img, qrCodePadding, qrCodeY, qrCodeWidth, qrCodeWidth);

      // Clean up
      root.unmount();
      document.body.removeChild(tempDiv);
      
      // Generate download link
      const dataUrl = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      switch (title){
        case "Send Money":
          link.download = `${phoneNumber}-${title.toLowerCase().replace(/\s/g, "-")}.png`;
          break;
        case "Pay Bill":
          link.download = `${paybillNumber}-${title.toLowerCase().replace(/\s/g, "-")}.png`;
          break;
        case "Buy Goods":
          link.download = `${tillNumber}-${title.toLowerCase().replace(/\s/g, "-")}.png`;
          break;
        case "Withdraw Money":
          link.download = `${agentNumber}-${title.toLowerCase().replace(/\s/g, "-")}.png`;
          break;
      }
      
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error generating image:", error);
    }
  };
  // Helper functions for the preview
  function getGridTemplateRows(title: string, showName: boolean): string {
    const sectionCount = getSectionCount(title, showName);
    return `repeat(${sectionCount}, minmax(80px, 1fr))`; // Each section gets equal space, minimum 80px
  }

  // Helper function to calculate poster height based on visible sections
  function calculatePosterMinHeight(title: string, showName: boolean): string {
    const sectionCount = getSectionCount(title, showName);
    return `${sectionCount * 80}px`; // Minimum height based on section count
  }

  function getSectionCount(title: string, showName: boolean): number {
    let count = 2; // Title + one content section by default
    
    if (title === "Pay Bill" || title === "Withdraw Money") {
      count = 3; // Title + two content sections
    }
    
    if (showName) {
      count += 1; // Add name section
    }
    
    return count;
  }

  // Updated renderMiddleSections to use the new color logic
  function renderMiddleSections(title: string, _color: string, showName: boolean) {
    const sections = [];
    const sectionColors = getSectionColors(title, showName);
    let sectionCount = showName 
      ? (title === "Pay Bill" || title === "Withdraw Money" ? 2 : 1) 
      : (title === "Pay Bill" || title === "Withdraw Money" ? 2 : 1);

    for (let i = 0; i < sectionCount; i++) {
      const sectionIndex = i + 1; // +1 because title is section 0
      const isWhite = sectionColors[sectionIndex] === "#ffffff";
      
      sections.push(
        <div
          key={i}
          className="flex flex-col justify-center"
          style={{
            backgroundColor: sectionColors[sectionIndex],
            minHeight: "80px",
            padding: "0.5rem 0",
            borderTop: "8px solid #1a2335",
            borderBottom: i === sectionCount - 1 && !showName ? "none" : "none"
          }}
        >
          {renderSectionContent(title, i, isWhite)}
        </div>
      );
    }

    return sections;
  }

  function renderSectionContent(title: string, sectionIndex: number, isWhite: boolean) {
    const textColor = isWhite ? "#000000" : "#ffffff";
    
    switch (title) {
      case "Send Money":
        return (
          <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-center py-2" style={{ color: textColor }}>
            {phoneNumber || "0722 256 123"}
          </div>
        );
      
      case "Pay Bill":
        if (sectionIndex === 0) {
          return (
            <>
              <div className="text-lg font-bold w-full py-1 px-0 text-center" style={{ color: textColor }}>
                Business Number
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-center py-1" style={{ color: textColor }}>
                {paybillNumber || "12345"}
              </div>
            </>
          );
        } else {
          return (
            <>
              <div className="text-lg font-bold w-full py-1 px-0 text-center" style={{ color: textColor }}>
                Account Number
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-center py-1" style={{ color: textColor }}>
                {accountNumber || "67890"}
              </div>
            </>
          );
        }
      
      case "Buy Goods":
        return (
          <>
            <div className="text-lg font-bold w-full py-1 px-0 text-center" style={{ color: textColor }}>
              Till Number
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-center py-1" style={{ color: textColor }}>
              {tillNumber || "54321"}
            </div>
          </>
        );
      
      case "Withdraw Money":
        if (sectionIndex === 0) {
          return (
            <>
              <div className="text-lg font-bold w-full py-1 px-0 text-center" style={{ color: textColor }}>
                Agent Number
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-center py-1" style={{ color: textColor }}>
                {agentNumber || "98765"}
              </div>
            </>
          );
        } else {
          return (
            <>
              <div className="text-lg font-bold w-full py-1 px-0 text-center" style={{ color: textColor }}>
                Store Number
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl lg:text-3xl font-bold text-center py-1" style={{ color: textColor }}>
                {storeNumber || "24680"}
              </div>
            </>
          );
        }
      
      default:
        return null;
    }
  }

  // Helper function to determine section colors
  function getSectionColors(title: string, showName: boolean): string[] {
    const sectionCount = getSectionCount(title, showName);
    const colors = [];
    
    // First section is always green
    colors.push(selectedColor);
    
    // Alternate colors for subsequent sections
    for (let i = 1; i < sectionCount; i++) {
      colors.push(colors[i-1] === selectedColor ? "#ffffff" : selectedColor);
    }
    
    return colors;
  }

  return (
    <div className="flex flex-col bg-gray-100">
      <div className="flex-1 flex flex-col md:flex-row px-4 py-4 sm:py-8 md:py-0 sm:px-6 lg:px-8 gap-8 relative z-10">
        {/* Left Column - App Info */}
        <div className="w-full md:w-1/2 flex flex-col justify-center md:py-12 md:px-8">
          {/* Header for medium screens and up - now in left column */}
          <div className="hidden md:block mb-8">
            <h1 className="text-4xl font-display font-bold text-green-600">
              M-poster
            </h1>
            <h3 className="text-lg font-display text-gray-800 mt-2 max-w-md">
              Your M-Pesa 🤝 Payment Poster
            </h3>
          </div>

          {/* App features */}
          <div className="flex flex-row gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm px-3 py-2 flex items-center border border-green-100 hover:border-green-400 cursor-pointer">
              <CheckIcon className="w-5 h-5 text-green-600 mr-1" />
              <span className="text-sm text-gray-700">100% Free</span>
            </div>
            <div className="bg-white rounded-lg shadow-sm px-3 py-2 flex items-center border border-blue-100 hover:border-blue-400 cursor-pointer">
              <LockIcon className="w-5 h-5 text-blue-600 mr-1" />
              <span className="text-sm text-gray-700">Works Offline</span>
            </div>
            <div className="bg-white rounded-lg shadow-sm px-3 py-2 flex items-center border border-purple-100 hover:border-purple-400 cursor-pointer">
              <GithubIcon className="w-5 h-5 text-purple-600 mr-1" />
              <a
                href="https://github.com/omondisteven/M-Poster"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                Open Source
              </a>
            </div>
          </div>

          <Card className="">
            <CardTitle className="px-6 text-xl  font-bold text-gray-900">
              Make Your Payment Poster
            </CardTitle>

            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Transaction Type Selector */}
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Type
                  </label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select 
                        onValueChange={(value: TRANSACTION_TYPE) => {
                          field.onChange(value);
                          // Update the title for display purposes
                          switch(value) {
                            case TRANSACTION_TYPE.SEND_MONEY:
                              setValue("title", "Send Money");
                              break;
                            case TRANSACTION_TYPE.PAYBILL:
                              setValue("title", "Pay Bill");
                              break;
                            case TRANSACTION_TYPE.TILL_NUMBER:
                              setValue("title", "Buy Goods");
                              break;
                            case TRANSACTION_TYPE.AGENT:
                              setValue("title", "Withdraw Money");
                              break;
                          }
                          // Clear irrelevant fields when type changes
                          setValue("phoneNumber", "");
                          setValue("paybillNumber", "");
                          setValue("accountNumber", "");
                          setValue("tillNumber", "");
                          setValue("agentNumber", "");
                          setValue("storeNumber", "");
                          trigger();
                        }}
                        value={field.value}
                      >
                        <SelectTrigger className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold">
                          <SelectValue placeholder="Select transaction type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TRANSACTION_TYPE.SEND_MONEY}>Send Money</SelectItem>
                          <SelectItem value={TRANSACTION_TYPE.PAYBILL}>Pay Bill</SelectItem>
                          <SelectItem value={TRANSACTION_TYPE.TILL_NUMBER}>Buy Goods</SelectItem>
                          <SelectItem value={TRANSACTION_TYPE.AGENT}>Withdraw Money</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.type && (
                    <p className="mt-1 text-sm text-red-500">{errors.type.message}</p>
                  )}
                </div>
                  {/* Radio buttons */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Generate QR Code for:
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          className="form-radio h-4 w-4 text-green-600"
                          checked={qrGenerationMethod === "push"}
                          onChange={() => setQrGenerationMethod("push")}
                        />
                        <span>Push STK</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          className="form-radio h-4 w-4 text-green-600"
                          checked={qrGenerationMethod === "mpesa"}
                          onChange={() => setQrGenerationMethod("mpesa")}
                        />
                        <span>M-Pesa App</span>
                      </label>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {qrGenerationMethod === "push" 
                        ? "Scanning will initiate an M-Pesa payment directly"
                        : "Scanning will open the M-Pesa app"}
                    </p>
                  </div>
                {/* Send Money Fields */}
                {watch("type") === TRANSACTION_TYPE.SEND_MONEY && (
                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <Controller
                      name="phoneNumber"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="phone"
                          type="tel"
                          value={field.value || ""}
                          onChange={(e) => {
                            // Get the formatted phone number
                            const formatted = formatPhoneNumber(e.target.value);
                            // Update the field value
                            field.onChange(formatted);
                          }}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold"
                          placeholder="0722 256 123"
                        />
                      )}
                    />
                    {errors.phoneNumber && (
                      <p className="mt-1 text-sm text-red-500">{errors.phoneNumber.message}</p>
                    )}
                  </div>
                )}

                {/* Pay Bill Fields */}
                {watch("type") === TRANSACTION_TYPE.PAYBILL && (
                  <>
                    <div>
                      <label htmlFor="paybillNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Business Number
                      </label>
                      <Controller
                        name="paybillNumber"
                        control={control}
                        render={({ field }) => (
                          <Input
                            id="paybillNumber"
                            type="text"
                            inputMode="numeric"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              field.onChange(value);
                            }}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold"
                            placeholder="123456"
                          />
                        )}
                      />
                      {errors.paybillNumber && (
                        <p className="mt-1 text-sm text-red-500">{errors.paybillNumber.message}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number
                      </label>
                      <Controller
                        name="accountNumber"
                        control={control}
                        render={({ field }) => (
                          <Input
                            id="accountNumber"
                            type="text"
                            value={field.value || ""}
                            onChange={field.onChange}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold"
                            placeholder="Account number"
                          />
                        )}
                      />
                      {errors.accountNumber && (
                        <p className="mt-1 text-sm text-red-500">{errors.accountNumber.message}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Buy Goods (Till Number) Fields */}
                {watch("type") === TRANSACTION_TYPE.TILL_NUMBER && (
                  <div>
                    <label htmlFor="tillNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Till Number
                    </label>
                    <Controller
                      name="tillNumber"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="tillNumber"
                          type="text"
                          inputMode="numeric"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            field.onChange(value);
                          }}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold"
                          placeholder="123456"
                        />
                      )}
                    />
                    {errors.tillNumber && (
                      <p className="mt-1 text-sm text-red-500">{errors.tillNumber.message}</p>
                    )}
                  </div>
                )}

                {/* Withdraw Money (Agent) Fields */}
                {watch("type") === TRANSACTION_TYPE.AGENT && (
                  <>
                    <div>
                      <label htmlFor="agentNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Agent Number
                      </label>
                      <Controller
                        name="agentNumber"
                        control={control}
                        render={({ field }) => (
                          <Input
                            id="agentNumber"
                            type="text"
                            inputMode="numeric"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              field.onChange(value);
                            }}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold"
                            placeholder="Agent number"
                          />
                        )}
                      />
                      {errors.agentNumber && (
                        <p className="mt-1 text-sm text-red-500">{errors.agentNumber.message}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="storeNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Store Number
                      </label>
                      <Controller
                        name="storeNumber"
                        control={control}
                        render={({ field }) => (
                          <Input
                            id="storeNumber"
                            type="text"
                            value={field.value || ""}
                            onChange={field.onChange}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold"
                            placeholder="Store number"
                          />
                        )}
                      />
                      {errors.storeNumber && (
                        <p className="mt-1 text-sm text-red-500">{errors.storeNumber.message}</p>
                      )}
                    </div>
                  </>
                )}
               
                {/* Show Name Checkbox and Name Input */}
                <div className="flex items-center space-x-2 mb-2">
                  <Controller
                    name="showName"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="showName"
                        checked={field.value}
                        onCheckedChange={(checked: boolean) => {
                          field.onChange(checked);
                        }}
                      />
                    )}
                  />
                  <label
                    htmlFor="showName"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Show Name Field
                  </label>
                </div>

                {watch("showName") && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name
                    </label>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="name"
                          type="text"
                          value={field.value || ""}
                          onChange={(e) => {
                            field.onChange(e.target.value.toUpperCase());
                          }}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none text-lg font-semibold"
                          placeholder="NELSON ANANGWE"
                        />
                      )}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                    )}
                  </div>
                )}

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Poster Color
                  </label>
                  <div className="flex items-center space-x-4">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`size-8 rounded-full border-2 flex items-center justify-center ${
                          selectedColor === color.value
                            ? "border-gray-800"
                            : "border-transparent"
                        } ${color.class}`}
                        onClick={() => setValue("selectedColor", color.value)}
                        aria-label={`Select ${color.name} color`}
                      >
                        {selectedColor === color.value && (
                          <CheckIcon className="h-5 w-5 text-white" />
                        )}
                      </button>
                    ))}
                    <div className="flex items-center">
                      <Controller
                        name="selectedColor"
                        control={control}
                        render={({ field }) => (
                          <ColorPicker
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            className="size-8 rounded-full"
                          />
                        )}
                      />
                      <span className="ml-2 text-xs text-gray-500">Custom</span>
                    </div>
                  </div>
                </div>

                {/* Download Button */}
                <motion.div
                  whileHover={{
                    scale: 1.05,
                    transition: {
                      duration: 0.2,
                    },
                  }}
                >
                  <Button
                    type="submit"
                    className="w-full bg-gray-800 text-white text-xl font-bold py-8 rounded-lg shadow-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isValid}
                  >
                    DOWNLOAD
                  </Button>
                </motion.div>
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-gray-500 mt-2 text-sm">
            Download It, Share It , Stick it anywhere !
          </div>
        </div>

        <div className="w-full md:w-1/2 flex flex-col items-center justify-center md:py-12">
        {/* Poster Container */}
        <div className="w-full max-w-lg">
          {/* QR Code Component */}
          <div className="w-full flex justify-center">
            <div 
              className="bg-white border-l-8 border-r-8 border-t-0 border-gray-800 flex flex-col w-full"
              style={{ 
                maxWidth: `${selectedTemplate.size.width}px`
              }}
            >
              {/* Enhanced Dark Gray Section with guaranteed visibility */}
              <div 
                className="w-full flex items-center justify-center py-4 px-2"
                style={{
                  backgroundColor: "rgb(8, 160, 66)",
                  borderTop: "8px solid #1a2335",  // Added top border
                  minHeight: "70px",
                  borderBottom: "8px solid #1a2335"
                }}
              >
                <p 
                  className="text-center text-3xl font-bold text-white whitespace-nowrap"
                  style={{
                    fontSize: "clamp(1.25rem, 4vw, 2rem)"
                  }}
                >
                  SCAN TO PAY!
                </p>
              </div>
              
              {/* QR Code Section */}
              <div className="w-full p-3" style={{ aspectRatio: "1/1" }}>
                {previewQrData ? (
                  <QrSvg
                    value={previewQrData}
                    className="qr-code-svg w-full h-full"
                    fgColor="#000000"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Generating QR code...
                  </div>
                )}
              </div>
            </div>
          </div>
            
          {/* Poster Preview */}
          <div
            id="poster"
            ref={posterRef}
            className="grid bg-white w-full shadow-lg overflow-hidden border-8 border-gray-800"
            style={{
              gridTemplateRows: getGridTemplateRows(title, showName),
              aspectRatio: `${selectedTemplate.size.width} / ${selectedTemplate.size.height}`,
              height: 'auto',
              minHeight: calculatePosterMinHeight(title, showName)
            }}
          >
            {/* Title Section (always first) */}
            <div 
              className="flex items-center justify-center" 
              style={{ 
                backgroundColor: selectedColor,
                minHeight: "80px",
                padding: "0.5rem 0"
              }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-white text-center px-2">{title.toUpperCase()}</h2>
            </div>

            {/* Middle Sections */}
            {renderMiddleSections(title, selectedColor, showName)}

            {/* Name Section (when showName is true) */}
            {showName && (
              <div
                className="flex items-center justify-center"
                style={{
                  backgroundColor: getSectionColors(title, showName)[getSectionCount(title, showName) - 1],
                  minHeight: "80px",
                  padding: "0.3rem 0",
                  borderTop: "8px solid #1a2335"
                }}
              >
                <div className="text-2xl sm:text-3xl font-bold text-center px-2"
                  style={{ 
                    color: getSectionColors(title, showName)[getSectionCount(title, showName) - 1] === selectedColor ? "#ffffff" : "#000000",
                    lineHeight: "80px"
                  }}
                >
                  {name || "NELSON ANANGWE"}
                </div>
              </div>
            )}
          </div>
            {/* Preview text */}
            <div className="flex flex-col items-center justify-center text-center mt-3">
              <p className="font-handwriting text-xl text-gray-600">
                Preview of your poster
              </p>
            </div>
            
          </div>

          {/* Template Selector */}
          <div className="w-full max-w-lg mt-8">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
              Select Template Size
              <span className="ml-2 text-xs text-gray-500 italic">
                (scroll horizontally to see more)
              </span>
            </h3>
            <div className="relative w-full rounded-xl overflow-hidden">
              {/* Left scroll indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-gray-100 to-transparent z-10 pointer-events-none flex items-center justify-start pl-1">
                <ChevronLeftIcon className="h-6 w-6 text-gray-500 animate-pulse" />
              </div>

              {/* Right scroll indicator */}
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-gray-100 to-transparent z-10 pointer-events-none flex items-center justify-end pr-1">
                <ChevronRightIcon className="h-6 w-6 text-gray-500 animate-pulse" />
              </div>

              <ScrollArea className="w-full h-[170px] rounded-lg">
                <div className="flex space-x-4 px-8 py-1 min-w-max">
                  {templates.map((template) => (
                    <div
                      key={template.slug}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-3 rounded-lg cursor-pointer transition-all w-[160px] h-[150px] flex flex-col ${
                        selectedTemplate.slug === template.slug
                          ? "bg-gray-800 text-white ring-2 ring-green-500"
                          : "bg-white hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      <div className="font-medium truncate">
                        {template.name}
                      </div>
                      <div className="text-xs mt-1 line-clamp-2 flex-grow">
                        {template.description}
                      </div>
                      <div
                        className={`text-xs mt-1 font-semibold ${
                          selectedTemplate.slug === template.slug
                            ? "text-green-300"
                            : "text-green-600"
                        }`}
                      >
                        {template.size.label}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          selectedTemplate.slug === template.slug
                            ? "text-gray-300"
                            : "text-gray-500"
                        }`}
                      >
                        {template.size.width}×{template.size.height}px
                      </div>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>

      {/* Twitter CTA for Template Contributions */}
      <div className="w-full py-4 bg-blue-50 border-t border-blue-100 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center sm:justify-between">
          <div className="flex items-center mb-3 sm:mb-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-blue-500 mr-2"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
              <path d="M4 4l11.733 16h4.267l-11.733 -16z"></path>
              <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path>
            </svg>            
          </div>          
        </div>
      </div>
    </div>
  );
}