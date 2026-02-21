import type { Config } from "prettier";

const prettierConfig: Config = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 80,
  bracketSpacing: true,
  plugins: ["prettier-plugin-tailwindcss"],
};

export default prettierConfig;
