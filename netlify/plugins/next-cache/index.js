// Keeps Next's build cache between Netlify builds. With output: 'export' it lives
// in .next/cache, not the distDir, so the Next.js Runtime doesn't find it.
const CACHE_DIR = '.next/cache';

export const onPreBuild = async ({ utils }) => {
  const restored = await utils.cache.restore(CACHE_DIR);
  console.log(restored ? `Restored ${CACHE_DIR}` : `No ${CACHE_DIR} to restore`);
};

export const onPostBuild = async ({ utils }) => {
  const saved = await utils.cache.save(CACHE_DIR);
  console.log(saved ? `Saved ${CACHE_DIR}` : `Nothing in ${CACHE_DIR} to save`);
};
