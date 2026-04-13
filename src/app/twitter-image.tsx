import { ImageResponse } from "next/og";
import {
  ROOT_SOCIAL_IMAGE_ALT,
  ROOT_SOCIAL_IMAGE_SIZE,
  renderRootSocialImage,
} from "@/lib/seo/root-social-image";

export const runtime = "edge";
export const alt = ROOT_SOCIAL_IMAGE_ALT;
export const size = ROOT_SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(renderRootSocialImage(), size);
}
