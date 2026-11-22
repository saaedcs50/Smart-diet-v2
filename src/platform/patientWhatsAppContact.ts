import { getSupabase } from './supabase';
import { normalizeEgyptianWhatsAppPhone } from './patientWhatsAppFollowUp';

export interface PatientWhatsAppContact {
  whatsappPhone: string | null;
  whatsappConsentAt: string | null;
  whatsappConsentBy: string | null;
}

export async function savePatientWhatsAppContact(input: {
  patientUid: string;
  phone: string;
  patientConsented: boolean;
}): Promise<PatientWhatsAppContact> {
  if (!input.patientUid.trim()) throw new Error('معرّف المريض غير صالح.');

  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('يجب تسجيل الدخول قبل تحديث بيانات التواصل.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, disabled')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new Error('تعذّر التحقق من صلاحيات حسابك.');
  if (!profile || profile.disabled || !['admin', 'coach'].includes(profile.role)) {
    throw new Error('تحديث بيانات واتساب متاح لطاقم العيادة فقط.');
  }

  const rawPhone = input.phone.trim();
  let patch: Record<string, string | null>;
  if (!rawPhone) {
    patch = {
      whatsapp_phone: null,
      whatsapp_consent_at: null,
      whatsapp_consent_by: null,
    };
  } else {
    if (!input.patientConsented) {
      throw new Error('أكد موافقة المريض على رسائل المتابعة قبل حفظ الرقم.');
    }
    const phone = normalizeEgyptianWhatsAppPhone(rawPhone);
    if (!phone) throw new Error('أدخل رقم موبايل مصري صحيحًا (010/011/012/015).');
    patch = {
      whatsapp_phone: phone,
      whatsapp_consent_at: new Date().toISOString(),
      whatsapp_consent_by: user.id,
    };
  }

  const { data, error } = await supabase
    .from('patients')
    .update(patch)
    .eq('id', input.patientUid)
    .select('whatsapp_phone, whatsapp_consent_at, whatsapp_consent_by')
    .maybeSingle();

  if (error) throw new Error(`تعذّر حفظ وسيلة التواصل: ${error.message}`);
  if (!data) throw new Error('لم تُحفظ البيانات؛ تأكد من أن المريض ضمن نطاق صلاحيتك.');
  return {
    whatsappPhone: data.whatsapp_phone ?? null,
    whatsappConsentAt: data.whatsapp_consent_at ?? null,
    whatsappConsentBy: data.whatsapp_consent_by ?? null,
  };
}
