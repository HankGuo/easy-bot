-- Create multiple databases for EasyBot and WeKnora
CREATE DATABASE weknora;
CREATE USER weknora WITH ENCRYPTED PASSWORD 'weknorapass';
GRANT ALL PRIVILEGES ON DATABASE weknora TO weknora;

\c weknora
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_search;
