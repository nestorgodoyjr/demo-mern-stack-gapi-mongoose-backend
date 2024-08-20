// googleSheetsService.js
import { google } from 'googleapis';
import { googleConfig } from '../config.js';

async function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
         
        credentials:{
    //         type: process.env.TYPE,
    //         project_id: process.env.PROJECT_ID,
    //         private_key_id: process.env.PRIVATE_KEY_ID,
             private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
             client_email: process.env.CLIENT_EMAIL,
    //         client_id: process.env.CLIENT_ID,
    //         auth_uri: process.env.AUTH_URI,
    //         token_uri: process.env.TOKEN_URI,
    //         auth_provider_x509_cert_url: process.env.AUTH_PROVIDER,
    //         client_x509_cert_url: process.env.CLIENT,
    //         universe_domain: process.env.UNIVERSAL_DOMAIN,
        },
        scopes: googleConfig.SCOPES,
    });

    //console.log()

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    return sheets;
}
export async function appendToGoogleSheet(data) {
  const sheets = await getSheetsClient();
  const resource = {
    values: data.map(business => [
      business.name,
      business.formatted_address,
      business.formatted_phone_number || 'N/A',
      business.website || 'N/A',
      business.rating || 'N/A',
      business.user_ratings_total || 'N/A',
      business.price_level !== undefined ? business.price_level : 'N/A',
      business.opening_hours?.open_now ? 'Open' : 'Closed',
    ]),
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId: googleConfig.SPREADSHEET_ID,
    range: 'Sheet1!A2',
    valueInputOption: 'RAW',
    resource,
  });
}
