-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams table
CREATE TABLE teams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_name VARCHAR(100) UNIQUE NOT NULL,
    lead_email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    team_members JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),
    current_stage INTEGER DEFAULT 1,
    is_disqualified BOOLEAN DEFAULT FALSE,
    quest_score INTEGER DEFAULT 0
);

-- Cipher questions table with SIH categories
CREATE TABLE cipher_questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hint TEXT NOT NULL,
    correct_answer VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    problem_domain VARCHAR(100) NOT NULL,
    difficulty INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 6,
    is_active BOOLEAN DEFAULT TRUE,
    cipher_type VARCHAR(50) DEFAULT 'wordle',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Problem statements table (SIH-like problems)
CREATE TABLE problem_statements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'Intermediate',
    tech_stack TEXT[] DEFAULT '{}',
    guidelines TEXT NOT NULL,
    submission_deadline TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quest sessions table (renamed from game_sessions)
CREATE TABLE quest_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    current_question_index INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    assigned_problem_id UUID REFERENCES problem_statements(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    quest_duration INTEGER DEFAULT 1800, -- 30 minutes in seconds
    UNIQUE(team_id)
);

-- Question attempts table
CREATE TABLE question_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    quest_session_id UUID REFERENCES quest_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES cipher_questions(id),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    attempts JSONB DEFAULT '[]',
    is_correct BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submissions table
CREATE TABLE submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    problem_id UUID REFERENCES problem_statements(id),
    ppt_url VARCHAR(500),
    prototype_url VARCHAR(500),
    github_url VARCHAR(500),
    description TEXT,
    submission_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_submitted BOOLEAN DEFAULT FALSE,
    quest_completion_time INTEGER -- Time taken to complete cipher quest in seconds
);

-- Judging scores table
CREATE TABLE judging_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    innovation_score INTEGER,
    implementation_score INTEGER,
    presentation_score INTEGER,
    quest_score INTEGER, -- Score from cipher quest
    total_score INTEGER,
    judge_notes TEXT,
    judged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    judged_by VARCHAR(100)
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    token VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample Cipher questions (SIH-themed)
INSERT INTO cipher_questions (hint, correct_answer, category, problem_domain, cipher_type) VALUES
('Technology for farmers to get real-time crop prices and weather alerts', 'AGRIWATCH', 'Agriculture', 'Smart Agriculture', 'wordle'),
('AI system to detect diseases from medical images using deep learning', 'MEDSCAN', 'Healthcare', 'Medical Diagnosis', 'wordle'),
('Blockchain platform for secure and transparent land registration', 'LANDBLOCK', 'Blockchain', 'Digital Governance', 'wordle'),
('Mobile app for citizens to report environmental pollution incidents', 'ECOALERT', 'Environment', 'Pollution Control', 'wordle'),
('VR platform for immersive classroom learning experiences', 'EDUVIRTUAL', 'Education', 'Digital Learning', 'wordle'),
('IoT device for smart waste management and route optimization', 'BINSENSE', 'IoT', 'Smart Cities', 'wordle'),
('AI chatbot for mental health support and crisis intervention', 'MENTORAI', 'Healthcare', 'Mental Health', 'wordle'),
('Platform connecting donors with NGOs for transparent fundraising', 'DONORLINK', 'Social', 'Non-Profit Tech', 'wordle'),
('Decentralized finance platform for micro-loans to farmers', 'FARMCREDIT', 'FinTech', 'Agricultural Finance', 'wordle'),
('AI-powered tool for detecting fake news and misinformation', 'TRUTHSCAN', 'AI/ML', 'Media Verification', 'wordle');

-- Insert sample problem statements
INSERT INTO problem_statements (title, description, category, domain, guidelines, submission_deadline) VALUES
('AI-Based Crop Disease Detection System', 'Develop an AI system that can detect crop diseases from images and suggest remedies. The system should work in real-time and be accessible to farmers via mobile app.', 'AI/ML', 'Agriculture', 'Submit detailed PPT and working prototype. Focus on accuracy, real-time performance, and farmer-friendly interface.', NOW() + INTERVAL '7 days'),
('Blockchain Land Registry System', 'Create a transparent and tamper-proof land registration system using blockchain technology. The system should prevent fraud and provide easy verification.', 'Blockchain', 'Governance', 'Include security features, user-friendly interface, and integration with existing land records. Demo must show complete workflow.', NOW() + INTERVAL '7 days'),
('Smart Waste Management IoT Solution', 'Build an IoT solution for optimizing waste collection routes and bin monitoring. Include sensors for fill-level detection and mobile app for municipal workers.', 'IoT', 'Smart Cities', 'Hardware prototype preferred with mobile app interface. Focus on cost-effectiveness and scalability.', NOW() + INTERVAL '7 days'),
('Mental Health Support Platform with AI', 'Develop a comprehensive platform with AI chatbot for mental health assistance, counselor connectivity, and emergency support features.', 'AI/ML', 'Healthcare', 'Focus on privacy, empathetic user experience, and integration with professional mental health services.', NOW() + INTERVAL '7 days'),
('Sustainable Energy Monitoring System', 'Create a system to monitor and optimize energy usage in smart buildings using IoT sensors and AI predictions.', 'IoT', 'Energy', 'Include real-time monitoring, predictive analytics, and user-friendly dashboard for energy management.', NOW() + INTERVAL '7 days');

-- Create indexes for better performance
CREATE INDEX idx_teams_email ON teams(lead_email);
CREATE INDEX idx_teams_team_name ON teams(team_name);
CREATE INDEX idx_quest_sessions_team_id ON quest_sessions(team_id);
CREATE INDEX idx_question_attempts_quest_session_id ON question_attempts(quest_session_id);
CREATE INDEX idx_submissions_team_id ON submissions(team_id);
CREATE INDEX idx_judging_scores_team_id ON judging_scores(team_id);
CREATE INDEX idx_cipher_questions_active ON cipher_questions(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE judging_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Teams can view own data" ON teams FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teams can update own data" ON teams FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Teams can view own quest sessions" ON quest_sessions FOR SELECT USING (team_id = auth.uid());
CREATE POLICY "Teams can view own submissions" ON submissions FOR SELECT USING (team_id = auth.uid());

