import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: false,
  testRegex: "\\.spec\\.(ts|js)$",
  setupFiles: ["./jest-pretest.ts"],
};

export default config;
