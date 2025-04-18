"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useFormStatus } from "react-dom"; // Import hooks for server actions
import { useActionState } from "react";
import {useApi} from '@arweave-wallet-kit/react';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRef, useEffect, useState } from "react";
import { uploadWillToArweave } from "./actions"; // Import the server action
import { toast } from "sonner"; // Import toast from sonner
import RequireWallet from '../components/RequireWallet';
import { useActiveAddress } from "@arweave-wallet-kit/react";
import Image from "next/image"; // Import the Next.js Image component
import { Badge } from "@/components/ui/badge"; // Import Badge for displaying emails
import { X } from "lucide-react"; // Import an icon for removal

// Define the maximum file size (e.g., 5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Define accepted file types
const ACCEPTED_FILE_TYPES = ["application/pdf"];

// Single email validation (for the input field)
const singleEmailSchema = z.string().email({ message: "Please enter a valid email address." });

// Custom validation for comma-separated emails (client-side) - This will be used to validate the final string
const commaSeparatedEmailsClient = z.string()
  .min(1, "At least one beneficiary email is required.")
  .refine(value => {
    if (!value) return false;
    const emails = value.split(',').map(email => email.trim()).filter(email => email.length > 0);
    if (emails.length === 0) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.every(email => emailRegex.test(email));
  }, "Invalid email format found in the list."); // Simplified message

// Define the form schema using Zod (client-side validation)
// Note: 'beneficiaries' here represents the FINAL comma-separated string we'll generate
const formSchema = z.object({
  willFile: z
    .instanceof(File, { message: "File is required." })
    .refine((file) => file?.size > 0, "File cannot be empty.")
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file?.type),
      "Only .pdf files are accepted."
    ),
  // This field will hold the comma-separated string generated from the list
  beneficiaries: commaSeparatedEmailsClient,
  powerOfAttorneyEmail: z
    .string()
    .email({ message: "Please enter a valid email address." })
    .optional()
    .or(z.literal('')),
});

// Type for form values inferred from schema
type FormValues = z.infer<typeof formSchema>;

// Separate component for the submit button to use useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Uploading..." : "Upload Will"}
    </Button>
  );
}

export default function AddWillPage() {
  const activeAddress = useActiveAddress();
  const [formKey, setFormKey] = useState(Date.now()); // Key to force form reset
  const api = useApi(); // Use the api hook
  
  // State to store Othent user details
  const [othentDetails, setOthentDetails] = useState<{ email?: string; name?: string } | null>(null); // More specific type
  const [isOthentLoading, setIsOthentLoading] = useState(false);

  // useFormState hook to manage server action state
  const [state, formAction] = useActionState(uploadWillToArweave, null);

  // 1. Define your form (primarily for client-side validation)
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      willFile: undefined,
      beneficiaries: "", // Initialize as empty, will be set before submit
      powerOfAttorneyEmail: "",
    },
    mode: "onChange",
  });

  // Ref for the file input to reset it
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State for Beneficiary Management ---
  const [beneficiaryInput, setBeneficiaryInput] = useState(""); // Current email input
  const [beneficiaryList, setBeneficiaryList] = useState<string[]>([]); // List of added emails
  const [beneficiaryError, setBeneficiaryError] = useState<string | null>(null); // Error for single email input

  // Effect to fetch Othent details
  useEffect(() => {
    const getOthentDetails = async () => {
      if (api?.othent && activeAddress && !othentDetails && !isOthentLoading) {
        setIsOthentLoading(true);
        console.log("Fetching Othent user details...");
        try {
          const details = await api.othent.getUserDetails();
          if (details?.email) {
            setOthentDetails(details);
            console.log("Othent details fetched:", details);
          } else {
            console.warn("Othent details fetched but no email found.");
            toast.error("Email Not Found", { description: "Could not retrieve your email from Othent. Please ensure it's linked." });
            setOthentDetails(null); // Ensure state reflects email not found
          }
        } catch (error) {
          console.error("Failed to fetch Othent details:", error);
          toast.error("Error fetching user details", { description: "Could not retrieve your email. Please try reconnecting." });
          setOthentDetails(null);
        } finally {
          setIsOthentLoading(false);
        }
      } else if (!activeAddress) {
        setOthentDetails(null); // Clear details if wallet disconnects
      }
    };
    getOthentDetails();
  }, [api, activeAddress, othentDetails, isOthentLoading]); // Rerun if dependencies change

  // Effect to show toast messages based on server action state
  useEffect(() => {
    if (state) {
      if (state.success === true) {
        toast.success("Success!", {
           // Display the success message and transaction IDs from the state
           description: `${state.message} Transaction IDs: PDF: ${state.transactionIds?.pdfTxId}, Key: ${state.transactionIds?.keyTxId}`,
           duration: 7000, // Increased duration
        });
        // Reset the form visually by changing the key
        setFormKey(Date.now());
        form.reset({ willFile: undefined, beneficiaries: "", powerOfAttorneyEmail: "" }); // Reset react-hook-form state
        setBeneficiaryList([]); // Clear beneficiary list on success
        setBeneficiaryInput(""); // Clear input field
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset the actual file input element
        }
      // If the action failed
      } else if (state.success === false) {
        // Show an error toast
        toast.error("Upload Failed", {
           // Display the error message and details from the state
           description: state.message + (state.error ? ` Details: ${state.error}` : ''),
           duration: 7000, // Increased duration
        });
      }
    }
    // This effect runs whenever the 'state' or 'form' object changes
  }, [state, form]);

  // --- Beneficiary Management Functions ---
  const handleAddBeneficiary = () => {
    const validation = singleEmailSchema.safeParse(beneficiaryInput);
    if (!validation.success) {
      setBeneficiaryError(validation.error.errors[0]?.message || "Invalid email format.");
      return;
    }
    const emailToAdd = validation.data.trim();
    if (beneficiaryList.includes(emailToAdd)) {
      setBeneficiaryError("This email has already been added.");
      return;
    }
    setBeneficiaryList([...beneficiaryList, emailToAdd]);
    setBeneficiaryInput(""); // Clear input
    setBeneficiaryError(null); // Clear error
    // Clear the main form error for beneficiaries if it was previously set
    form.clearErrors("beneficiaries");
  };

  const handleRemoveBeneficiary = (emailToRemove: string) => {
    setBeneficiaryList(beneficiaryList.filter(email => email !== emailToRemove));
  };

  // --- Form Submission ---
  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission

    // 1. Check Othent details
    if (!othentDetails?.email || !activeAddress) {
      toast.error("User Details Missing", { description: "Cannot submit without verified user email and wallet address." });
      return;
    }

    // 2. Validate Beneficiary List (at least one required)
    if (beneficiaryList.length === 0) {
      form.setError("beneficiaries", { type: "manual", message: "Please add at least one beneficiary email." });
      return; // Stop submission
    } else {
      form.clearErrors("beneficiaries"); // Clear error if list is now populated
    }

    // 3. Generate comma-separated string and set form value for validation
    const beneficiariesString = beneficiaryList.join(',');
    form.setValue('beneficiaries', beneficiariesString, { shouldValidate: true }); // Set and validate

    // 4. Trigger react-hook-form validation for other fields
    const isValid = await form.trigger(); // Check willFile, powerOfAttorneyEmail, and the generated beneficiaries string
    if (!isValid) {
      toast.error("Validation Error", { description: "Please check the form fields for errors." });
      console.log("Validation errors:", form.formState.errors); // Log errors for debugging
      return; // Stop if validation fails
    }

    // 5. Prepare FormData manually
    const formData = new FormData(); // Create an empty FormData object

    // Get values managed by react-hook-form
    const formValues = form.getValues();

    // Append fields manually
    if (formValues.willFile) {
      formData.append('willFile', formValues.willFile);
    }
    formData.append('beneficiaries', beneficiariesString); // Use the generated string
    if (formValues.powerOfAttorneyEmail) { // Append only if it has a value
        formData.append('powerOfAttorneyEmail', formValues.powerOfAttorneyEmail);
    } else {
        formData.append('powerOfAttorneyEmail', ''); // Ensure it's present but empty if optional and not provided
    }
    formData.append('userWalletAddress', activeAddress); // Add wallet address
    formData.append('userEmail', othentDetails.email); // Add verified user email

    // Log FormData contents for debugging (optional)
    // for (let [key, value] of formData.entries()) {
    //   console.log(`${key}:`, value);
    // }

    // 6. Call the server action
    formAction(formData);
  };

  return (
    <RequireWallet>
      <div className="flex flex-1 items-center justify-center p-4 py-2 lg:p-6">
        {/* Inner container */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-6xl">

          {/* Left Column: Form Card - Comes first in code */}
          <div className="w-full max-w-md lg:w-1/2 flex justify-center">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Upload Your Digital Will</CardTitle>
                <CardDescription>
                  Securely upload your encrypted will document (.pdf, max 5MB). Specify beneficiaries and optionally a Power of Attorney.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form} key={formKey}>
                  <form
                    onSubmit={handleFormSubmit}
                    className="space-y-8"
                  >
                    <FormField
                      control={form.control}
                      name="willFile"
                      render={({ field: { onChange, value, onBlur, name, ref: rhfRef } }) => (
                        <FormItem>
                          <FormLabel>Will Document (.pdf)</FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept=".pdf"
                              ref={fileInputRef}
                              onChange={(e) => {
                                onChange(e.target.files?.[0] ?? undefined);
                              }}
                              onBlur={onBlur}
                              name={name}
                            />
                          </FormControl>
                          <FormDescription>
                            Select the PDF file containing your will (max 5MB).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>Beneficiary Emails</FormLabel>
                      <div className="flex items-start space-x-2">
                        <Input
                          placeholder="beneficiary@example.com"
                          value={beneficiaryInput}
                          onChange={(e) => {
                            setBeneficiaryInput(e.target.value);
                            if (beneficiaryError) setBeneficiaryError(null); // Clear error on typing
                          }}
                          className="flex-grow"
                        />
                        <Button
                          type="button" // Prevent form submission
                          onClick={handleAddBeneficiary}
                          variant="outline"
                          disabled={!beneficiaryInput.trim()}
                        >
                          Add
                        </Button>
                      </div>
                      {/* Display error for the single email input */}
                      {beneficiaryError && <p className="text-sm font-medium text-destructive">{beneficiaryError}</p>}
                      {/* Display error from react-hook-form for the overall beneficiaries field (e.g., "at least one required") */}
                      <FormMessage>{form.formState.errors.beneficiaries?.message}</FormMessage>

                      {/* Display Added Beneficiaries */}
                      {beneficiaryList.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium">Added Beneficiaries:</p>
                          <div className="flex flex-wrap gap-2">
                            {beneficiaryList.map((email) => (
                              <Badge key={email} variant="secondary" className="flex items-center gap-1">
                                {email}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBeneficiary(email)}
                                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                  aria-label={`Remove ${email}`}
                                >
                                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <FormDescription>
                        Add the email addresses of the beneficiaries one by one.
                      </FormDescription>
                    </FormItem>
                    <FormField
                      control={form.control}
                      name="powerOfAttorneyEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Power of Attorney Email (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="poa@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Optionally, enter the email address of the designated Power of Attorney.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {state && state.success === false && !state.error?.includes('{') && (
                      <p className="text-sm font-medium text-destructive">{state.message}</p>
                    )}
                    <SubmitButton />
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Image with Text Overlay - Comes second in code */}
          {/* Added fixed height container */}
          <div className="w-full max-w-md lg:w-1/2 flex justify-center items-center h-[400px]"> {/* Consistent height */}
            {/* Relative container for overlay */}
            <div className="relative w-full h-full"> {/* Make relative container fill height */}
              <Image
                src="/vault.jpg"
                alt="Vault representing secure will storage"
                width={1000} // Aspect ratio hint
                height={1000} // Aspect ratio hint
                priority
                className="object-contain w-full h-full rounded-md" // Fill container
              />
              {/* Absolute positioned overlay for text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4 text-center rounded-md">
                <p className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
                  Your Legacy, Secured Forever.
                </p>
                <p className="text-white text-sm md:text-base font-light">
                  Create smart wills with trustless access, encrypted
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </RequireWallet>
  );
}
