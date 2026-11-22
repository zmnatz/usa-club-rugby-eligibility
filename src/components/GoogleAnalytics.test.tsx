import { describe, expect, test } from "bun:test";
import { Children, isValidElement, type ReactElement } from "react";
import { GoogleAnalytics } from "./GoogleAnalytics";

type ScriptProps = { id: string; src?: string; strategy: string; children?: string };

function scripts(id: string): ScriptProps[] {
  const tree = GoogleAnalytics({ id }) as ReactElement<{ children: ReactElement<ScriptProps>[] }> | null;
  if (!tree) return [];
  return Children.toArray(tree.props.children)
    .filter(isValidElement)
    .map((child) => (child as ReactElement<ScriptProps>).props);
}

describe("GoogleAnalytics", () => {
  test("loads nothing without a measurement ID", () => {
    expect(GoogleAnalytics({ id: "" })).toBeNull();
  });

  test("loads the Google tag for the measurement ID after the page is interactive", () => {
    const [tag, config] = scripts("G-TEST123");
    expect(tag.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-TEST123");
    expect(tag.strategy).toBe("afterInteractive");
    expect(config.strategy).toBe("afterInteractive");
    expect(config.children).toContain(`gtag('config', "G-TEST123");`);
  });

  test("quotes the ID rather than writing it into the script as code", () => {
    const [tag, config] = scripts("G-1'); alert(1); ('");
    expect(tag.src).toEndWith("?id=G-1')%3B%20alert(1)%3B%20('");
    expect(config.children).toContain(`gtag('config', "G-1'); alert(1); ('");`);
  });
});
