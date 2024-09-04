import User from '.././models/userModel.js';
import jwt from 'jsonwebtoken';

export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email, password });
    await user.save();
    console.log(username);
    console.log(email);
    console.log(password);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    console.log('JWT_SECRET:', process.env.JWT_SECRET);


    res.json({ token, user });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Error logging in user' });
  }
};
