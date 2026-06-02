import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey && process.env.NODE_ENV === 'production') {
  console.warn('RESEND_API_KEY is missing. Emails will not be sent.');
}

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const EMAIL_CONFIG = {
  from: {
    reports: 'Usthad Academy Reports <reports@usthadacademy.com>',
    noreply: 'Usthad Academy <no-reply@usthadacademy.com>',
    security: 'Usthad Academy Security <security@usthadacademy.com>',
  },
  domain: 'usthadacademy.com',
};
