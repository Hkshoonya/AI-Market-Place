import posthog from "posthog-js";

export const analytics = {
  modelViewed: (modelId: string, modelName: string) =>
    posthog.capture("model_viewed", { model_id: modelId, model_name: modelName }),
  modelCompared: (modelIds: string[]) =>
    posthog.capture("model_compared", { model_ids: modelIds, count: modelIds.length }),
  listingViewed: (listingId: string, listingName: string) =>
    posthog.capture("listing_viewed", { listing_id: listingId, listing_name: listingName }),
  auctionBid: (auctionId: string, amount: number) =>
    posthog.capture("auction_bid", { auction_id: auctionId, bid_amount: amount }),
  lensSwitched: (fromLens: string, toLens: string) =>
    posthog.capture("lens_switched", { from_lens: fromLens, to_lens: toLens }),
  searchPerformed: (query: string, resultCount: number) =>
    posthog.capture("search_performed", { query_length: query.length, result_count: resultCount }),
};
