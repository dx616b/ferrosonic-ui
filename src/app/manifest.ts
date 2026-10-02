import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ferrosonic",
    short_name: "Ferrosonic",
    description: "Control the Ferrosonic player.",
    start_url: "/",
    display: "standalone",
    background_color: "#07131c",
    theme_color: "#07131c",
  };
}
