import { describe, expect, it } from "vitest";

import { __testables } from "./x-announcements";

const RSS_FEED = `
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <item>
      <title><![CDATA[Introducing GPT-5, now available in the API with benchmark gains]]></title>
      <description><![CDATA[<p>Introducing GPT-5, now available in the API with benchmark gains.</p><img src="https://images.example.com/gpt5.png" />]]></description>
      <link>https://x.com/OpenAI/status/1234567890</link>
      <pubDate>Mon, 16 Mar 2026 03:00:00 GMT</pubDate>
      <media:content url="https://images.example.com/gpt5-alt.png" />
    </item>
  </channel>
</rss>
`;

describe("x-announcements parser", () => {
  it("extracts tweet ids and preview images from RSS items", () => {
    const tweets = __testables.parseRssFeed(RSS_FEED, "OpenAI");

    expect(tweets).toHaveLength(1);
    expect(tweets[0]).toEqual(
      expect.objectContaining({
        id: "1234567890",
        imageUrl: "https://images.example.com/gpt5-alt.png",
      })
    );
  });

  it("falls back to embedded image tags when media tags are absent", () => {
    const imageUrl = __testables.extractImageUrl(
      '<description><![CDATA[<img src="https://images.example.com/from-img-tag.png" />]]></description>'
    );

    expect(imageUrl).toBe("https://images.example.com/from-img-tag.png");
  });
});
