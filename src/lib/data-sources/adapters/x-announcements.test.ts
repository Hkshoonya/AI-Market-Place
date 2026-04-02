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

const BLOCKED_RSS_FEED = `
<rss version="2.0">
  <channel>
    <title>RSS reader not yet whitelisted!</title>
    <item>
      <title>RSS reader not yet whitelisted!</title>
      <description>Please send an email RSS [AT] xcancel [DOT] com.</description>
      <link>https://rss.xcancel.com/OpenAI/rss</link>
      <pubDate>Mon, 16 Mar 2026 03:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`;

const SYNDICATION_HTML = `
<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"timeline":{"entries":[
        {"type":"tweet","content":{"tweet":{
          "id_str":"2029620619743219811",
          "created_at":"Mon, 16 Mar 2026 03:00:00 GMT",
          "full_text":"Introducing GPT-5.4, now available in the API with benchmark gains.",
          "permalink":"/OpenAI/status/2029620619743219811",
          "entities":{"media":[{"media_url_https":"https://images.example.com/gpt5.png"}]}
        }}},
        {"type":"tweet","content":{"tweet":{
          "id_str":"2029620619743219812",
          "created_at":"Mon, 16 Mar 2026 03:10:00 GMT",
          "full_text":"RT @someone: quoted launch",
          "permalink":"/OpenAI/status/2029620619743219812"
        }}}
      ]}}}}
    </script>
  </body>
</html>
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

  it("rejects blocked xcancel whitelist feeds as unusable", () => {
    expect(__testables.isUsableRssFeed(BLOCKED_RSS_FEED, "OpenAI")).toBe(false);
  });

  it("extracts timeline tweets from the syndication payload", () => {
    const tweets = __testables.parseSyndicationTimeline(SYNDICATION_HTML, "OpenAI");

    expect(tweets).toHaveLength(1);
    expect(tweets[0]).toEqual(
      expect.objectContaining({
        id: "2029620619743219811",
        imageUrl: "https://images.example.com/gpt5.png",
        url: "https://x.com/OpenAI/status/2029620619743219811",
      })
    );
    expect(tweets[0].text).toContain("GPT-5.4");
  });

  it("treats GLM and MiniMax launch posts as model-related", () => {
    expect(__testables.isModelRelated("GLM-5.1 is live for coding agents today")).toBe(true);
    expect(__testables.isModelRelated("MiniMax M2.7 is now available in the API")).toBe(true);
  });

  it("marks fragile social accounts as optional coverage when other sources already cover them", () => {
    expect(__testables.monitoredAccounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ handle: "MiniMax__AI", provider: "MiniMax", optional: true }),
        expect.objectContaining({ handle: "huggingface", provider: "Hugging Face", optional: true }),
        expect.objectContaining({ handle: "Zai_org", provider: "Z.ai" }),
      ])
    );
  });
});
