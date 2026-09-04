export interface OtpDeliveryResult {
  success: boolean;
  message: string;
}

export interface OtpProvider {
  sendOtp(phone: string, otp: string): Promise<OtpDeliveryResult>;
}
