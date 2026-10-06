"use server";

import { redirect } from "next/navigation";
import { reprocessDeadLetter, reprocessImportJob, reprocessScheduledJob } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { actionErrorMessage } from "@/lib/action-errors";

async function actor(){const user=await getCurrentUser();if(!user)redirect("/login");return user;}
const reason=(formData:FormData)=>String(formData.get("reason")??"").trim();
export async function reprocessScheduledJobAction(jobId:string,formData:FormData){const user=await actor();try{await reprocessScheduledJob(user.id,jobId,{reason:reason(formData)});}catch(error){redirect(`/admin/operacoes?erro=${encodeURIComponent(actionErrorMessage(error, "Falha ao reprocessar job."))}`);}redirect("/admin/operacoes?reprocessado=1");}
export async function reprocessImportJobAction(jobId:string,formData:FormData){const user=await actor();try{await reprocessImportJob(user.id,jobId,{reason:reason(formData)});}catch(error){redirect(`/admin/operacoes?erro=${encodeURIComponent(actionErrorMessage(error, "Falha ao reprocessar importação."))}`);}redirect("/admin/operacoes?reprocessado=1");}
export async function reprocessDeadLetterAction(eventId:string,formData:FormData){const user=await actor();try{await reprocessDeadLetter(user.id,eventId,{reason:reason(formData)});}catch(error){redirect(`/admin/operacoes?erro=${encodeURIComponent(actionErrorMessage(error, "Falha ao reprocessar evento."))}`);}redirect("/admin/operacoes?reprocessado=1");}
