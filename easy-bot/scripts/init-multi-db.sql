-- EasyBot Multi-Database & User Initialization Script
-- Executed on first startup of ParadeDB / PostgreSQL cluster

-- 1. WeKnora Enterprise Knowledge Database & User
CREATE DATABASE weknora;
CREATE USER weknora WITH ENCRYPTED PASSWORD 'weknora_secure_pass_2026';
GRANT ALL PRIVILEGES ON DATABASE weknora TO weknora;

-- 2. Octop Multi-Agent & Channel Platform Database & User
CREATE DATABASE octop;
CREATE USER octop WITH ENCRYPTED PASSWORD 'octop_secure_pass_2026';
GRANT ALL PRIVILEGES ON DATABASE octop TO octop;

-- 3. WeKnora Database Extensions (pgvector & pg_search BM25)
\c weknora
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_search;
GRANT ALL ON SCHEMA public TO weknora;

-- 4. Octop Database Extensions
\c octop
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO octop;
