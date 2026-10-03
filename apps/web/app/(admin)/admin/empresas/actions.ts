"use server";

import { redirect } from "next/navigation";
import { updateAdminSubscription } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";

const optionalDate=(formData:FormData,name:string)=>String(formData.get(name)??"")||undefined;
export async function updateSubscriptionAction(companyId:string,formData:FormData){
  const user=await getCurrentUser();if(!user)redirect("/login");
  try{await updateAdminSubscription(user.id,companyId,{status:String(formData.get("status")??""),planCode:String(formData.get("planCode")??""),trialEndsAt:optionalDate(formData,"trialEndsAt"),currentPeriodEnd:optionalDate(formData,"currentPeriodEnd"),graceEndsAt:optionalDate(formData,"graceEndsAt"),cancellationEffectiveAt:optionalDate(formData,"cancellationEffectiveAt"),billingExempt:formData.get("billingExempt")==="on",reason:String(formData.get("reason")??"")});}
  catch(error){redirect(`/admin/empresas?erro=${encodeURIComponent(error instanceof Error?error.message:"Não foi possível atualizar a assinatura.")}`);}
  redirect("/admin/empresas?atualizada=1");
}
