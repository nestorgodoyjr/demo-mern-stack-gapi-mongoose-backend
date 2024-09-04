import Business from '.././models/businessModel.js';
import { appendToGoogleSheet } from '.././services/googleSheetService.js';

export const addBusiness = async (req, res) => {
  const { userId } = req.user; 
  const businessData = req.body;

  try {
    const business = new Business({ ...businessData, user: userId });
    await business.save();
    await appendToGoogleSheet([business]); 
    res.status(201).json(business);
  } catch (error) {
    console.error('Error adding business:', error);
    res.status(500).json({ error: 'Error adding business' });
  }
};
