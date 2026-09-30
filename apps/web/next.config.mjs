/** @type {import('next').NextConfig} */
const nextConfig = {
  // drizzle-orm + postgres must load as real Node modules: bundling them
  // breaks dev under pnpm (missing vendor-chunks) and bloats server output.
  serverComponentsExternalPackages: ["drizzle-orm", "postgres"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};
export default nextConfig;
