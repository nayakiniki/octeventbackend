const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabaseClient');
const EmailService = require('../lib/emailService');

// Register team for CipherQuest
router.post('/register', async (req, res) => {
  try {
    const { teamName, leadEmail, password, teamMembers } = req.body;

    // Validate input
    if (!teamName || !leadEmail || !password) {
      return res.status(400).json({ 
        error: 'Team name, lead email, and password are required' 
      });
    }

    // Check if team already exists
    const { data: existingTeam, error: checkError } = await supabase
      .from('teams')
      .select('id')
      .or(`team_name.eq.${teamName},lead_email.eq.${leadEmail}`)
      .single();

    if (existingTeam) {
      return res.status(400).json({ 
        error: 'Team name or email already registered for CipherQuest' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = uuidv4();

    // Create team
    const { data: team, error } = await supabase
      .from('teams')
      .insert([
        {
          team_name: teamName,
          lead_email: leadEmail,
          password: hashedPassword,
          team_members: teamMembers || [],
          verification_token: verificationToken
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Send verification email
    await EmailService.sendVerificationEmail(leadEmail, verificationToken, teamName);

    res.status(201).json({
      message: 'Team registered successfully for CipherQuest! Please check your email for verification.',
      teamId: team.id,
      teamName: team.team_name
    });
  } catch (error) {
    console.error('CipherQuest registration error:', error);
    res.status(500).json({ error: 'Registration failed for CipherQuest' });
  }
});

// Login to CipherQuest
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get team by email
    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('lead_email', email)
      .single();

    if (error || !team) {
      return res.status(401).json({ error: 'Invalid CipherQuest credentials' });
    }

    // Check if email is verified
    if (!team.email_verified) {
      return res.status(401).json({ 
        error: 'Please verify your email before accessing CipherQuest',
        needsVerification: true
      });
    }

    // Check if team is disqualified
    if (team.is_disqualified) {
      return res.status(401).json({ 
        error: 'Your team has been disqualified from CipherQuest',
        disqualified: true
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, team.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid CipherQuest credentials' });
    }

    // Update last login
    await supabase
      .from('teams')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', team.id);

    res.json({
      message: 'Welcome back to CipherQuest!',
      team: {
        id: team.id,
        team_name: team.team_name,
        lead_email: team.lead_email,
        team_members: team.team_members,
        current_stage: team.current_stage,
        quest_score: team.quest_score,
        is_disqualified: team.is_disqualified
      }
    });
  } catch (error) {
    console.error('CipherQuest login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify email for CipherQuest
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (error || !team) {
      return res.status(400).json({ error: 'Invalid verification token for CipherQuest' });
    }

    await supabase
      .from('teams')
      .update({ 
        email_verified: true,
        verification_token: null 
      })
      .eq('id', team.id);

    res.json({ 
      message: 'Email verified successfully! You can now access CipherQuest.',
      teamName: team.team_name
    });
  } catch (error) {
    console.error('CipherQuest verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Forgot password for CipherQuest
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { data: team, error } = await supabase
      .from('teams')
      .select('id, team_name')
      .eq('lead_email', email)
      .single();

    if (team) {
      const resetToken = uuidv4();
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      await supabase
        .from('password_reset_tokens')
        .insert([
          {
            team_id: team.id,
            token: resetToken,
            expires_at: expiresAt.toISOString()
          }
        ]);

      await EmailService.sendPasswordResetEmail(email, resetToken, team.team_name);
    }

    res.json({ 
      message: 'If this email is registered with CipherQuest, password reset instructions have been sent.' 
    });
  } catch (error) {
    console.error('CipherQuest forgot password error:', error);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

// Reset password for CipherQuest
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token for CipherQuest' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await supabase
      .from('teams')
      .update({ password: hashedPassword })
      .eq('id', resetToken.team_id);

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetToken.id);

    res.json({ message: 'CipherQuest password reset successfully! You can now login with your new password.' });
  } catch (error) {
    console.error('CipherQuest reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('lead_email', email)
      .single();

    if (error || !team) {
      return res.status(404).json({ error: 'Team not found in CipherQuest' });
    }

    if (team.email_verified) {
      return res.status(400).json({ error: 'Email already verified for CipherQuest' });
    }

    const newVerificationToken = uuidv4();

    await supabase
      .from('teams')
      .update({ verification_token: newVerificationToken })
      .eq('id', team.id);

    await EmailService.sendVerificationEmail(email, newVerificationToken, team.team_name);

    res.json({ message: 'Verification email resent for CipherQuest. Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

module.exports = router;
