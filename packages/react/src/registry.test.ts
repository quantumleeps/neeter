import { describe, expect, it } from "vitest";
import { getWidget, registerWidget, stripMcpPrefix } from "./registry.js";

describe("Widget Registry", () => {
  it("registerWidget + getWidget roundtrip", () => {
    const component = () => null;
    registerWidget({ toolName: "test_tool", label: "Test", component });
    const reg = getWidget("test_tool");
    expect(reg).toBeDefined();
    expect(reg?.label).toBe("Test");
    expect(reg?.component).toBe(component);
  });

  it("getWidget returns undefined for unregistered name", () => {
    expect(getWidget("nonexistent_widget")).toBeUndefined();
  });
});

describe("stripMcpPrefix", () => {
  it("strips mcp__server__tool prefix", () => {
    expect(stripMcpPrefix("mcp__myserver__read_file")).toBe("read_file");
  });

  it("leaves names without prefix unchanged", () => {
    expect(stripMcpPrefix("search")).toBe("search");
  });

  it("handles multiple underscores in tool name", () => {
    expect(stripMcpPrefix("mcp__srv__my_long_tool_name")).toBe("my_long_tool_name");
  });
});
