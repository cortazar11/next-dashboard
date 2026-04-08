'use server';

import { z } from 'zod'; 
import postgres from 'postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';


const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });


const CreateInvoiceSchema = z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.coerce.number().positive(),
    status: z.enum(['pending', 'paid']),
    date: z.string()
});

const CreateInvoiceInputSchema = CreateInvoiceSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    const {customerId, amount, status   }=CreateInvoiceInputSchema.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    }); 
    
    const amountInCents=amount*100; // Convert dollars to cents for storage
    const date=new Date().toISOString().split('T')[0]; // Set the current date for the invoice
    // Here you would typically call your database or an external API to create the invoice 
    try {
        await sql`
          INSERT INTO invoices (customer_id, amount, status, date)
          VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
      } catch (error) {
    // We'll also log the error to the console for now
        console.error(error);
        return {
          message: 'Database Error: Failed to Create Invoice.',
        };
     }

    revalidatePath('/dashboard/invoices'); // Revalidate the invoices page to show the new invoice
    redirect('/dashboard/invoices'); // Redirect back to the invoices page after creation
    }

    // Use Zod to update the expected types
const UpdateInvoice = CreateInvoiceSchema.omit({id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  const amountInCents = amount * 100;
 
  try {
      await sql`
          UPDATE invoices
          SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
          WHERE id = ${id}
        `;
    } catch (error) {
        // We'll also log the error to the console for now
        console.error(error);
        return { message: 'Database Error: Failed to Update Invoice.' };
    }
 
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}