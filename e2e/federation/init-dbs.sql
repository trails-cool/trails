-- Second instance database. trails_a is the image's POSTGRES_DB (the
-- postgis image creates the extension there itself); trails_b needs
-- both created by hand. Runs once on first postgres boot.
CREATE DATABASE trails_b;
\connect trails_b
CREATE EXTENSION IF NOT EXISTS postgis;
