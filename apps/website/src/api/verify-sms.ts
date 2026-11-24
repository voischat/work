export interface SendVerifySmsBody {
  phone: string
  countrycode: string
  verify_id: string
  verify_answer: string
  smstype: 'work-login' | 'work-regist' | 'work-bind-phone' | 'work-reset-password' | 'work-unregist'
}
