import dotenv from 'dotenv';
dotenv.config();
export const googleConfig = {
    SCOPES: ['https://www.googleapis.com/auth/spreadsheets'],
    SPREADSHEET_ID: process.env.SPREADSHEET_ID,
    credentials: {
      private_key: process.env.PRIVATE_KEY_ID.replace(/\\n/g, '\n'),
      client_email: process.env.CLIENT_EMAIL,
    },
  };
  