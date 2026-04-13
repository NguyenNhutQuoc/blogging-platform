-- Custom migration: add GIN index for PostgreSQL full-text search on posts.search_vector
-- drizzle-kit cannot generate GIN indexes for custom tsvector columns, so we add it manually.

CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN(search_vector);

-- Trigger to auto-update search_vector when post content changes
CREATE OR REPLACE FUNCTION update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(regexp_replace(NEW.content, '<[^>]+>', ' ', 'g'), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_post_search_vector
  BEFORE INSERT OR UPDATE OF title, excerpt, content
  ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_post_search_vector();
