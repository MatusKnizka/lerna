import {
  commandRunner,
  gitAdd,
  gitCommit,
  gitTag,
  initFixtureFactory,
  showCommit,
} from "@lerna/test-helpers";
import fs from "fs-extra";
import path from "path";

jest.mock("@lerna/core", () => {
  // eslint-disable-next-line jest/no-mocks-import, @typescript-eslint/no-var-requires
  const mockCore = require("../../__mocks__/@lerna/core");
  return {
    ...mockCore,
    // we're actually testing integration with git
    collectUpdates: jest.requireActual("@lerna/core").collectUpdates,
  };
});

jest.mock("@lerna/commands/version/lib/git-add");
jest.mock("@lerna/commands/version/lib/git-commit");
jest.mock("@lerna/commands/version/lib/git-push");
jest.mock("@lerna/commands/version/lib/is-anything-committed", () => ({
  isAnythingCommitted: jest.fn().mockReturnValue(true),
}));
jest.mock("@lerna/commands/version/lib/is-behind-upstream", () => ({
  isBehindUpstream: jest.fn().mockReturnValue(false),
}));
jest.mock("@lerna/commands/version/lib/remote-branch-exists", () => ({
  remoteBranchExists: jest.fn().mockResolvedValue(true),
}));

const initFixture = initFixtureFactory(path.resolve(__dirname, "../../../../../libs/commands/publish"));

// test command
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lernaVersion = commandRunner(require("../src/command"));

// stabilize commit SHA
// eslint-disable-next-line @typescript-eslint/no-var-requires
expect.addSnapshotSerializer(require("@lerna/test-helpers/src/lib/serializers/serialize-git-sha"));

// TODO: figure out why these tests can't run with the mocks but others can
describe.skip("version --ignore-changes", () => {
  const setupChanges = async (cwd, tuples) => {
    await gitTag(cwd, "v1.0.0");
    await Promise.all(
      tuples.map(([filePath, content]) => fs.outputFile(path.join(cwd, filePath), content, "utf8"))
    );
    await gitAdd(cwd, ".");
    await gitCommit(cwd, "setup");
  };

  it("does not version packages with ignored changes", async () => {
    const cwd = await initFixture("normal");

    await setupChanges(cwd, [
      ["packages/package-2/README.md", "oh"],
      ["packages/package-3/__tests__/pkg3.test.js", "hai"],
      ["packages/package-4/lib/foo.js", "there"],
    ]);

    await lernaVersion(cwd)(
      "--ignore-changes",
      "README.md",

      "--ignore-changes",
      "**/__tests__/**",

      "--ignore-changes",
      "package-4" // notably does NOT work, needs to be "**/package-4/**" to match
    );

    const changedFiles = await showCommit(cwd, "--name-only");
    expect(changedFiles).toMatchSnapshot();
  });

  it("is mapped from deprecated --ignore", async () => {
    const cwd = await initFixture("normal");

    await setupChanges(cwd, [
      ["packages/package-3/README.md", "wat"],
      ["packages/package-4/lib/foo.js", "hey"],
    ]);

    await lernaVersion(cwd)("--ignore", "*.md");

    const changedFiles = await showCommit(cwd, "--name-only");
    expect(changedFiles).toMatchSnapshot();
  });
});
