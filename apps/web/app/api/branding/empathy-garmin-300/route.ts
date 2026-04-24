import { ImageResponse } from "next/og";
import React from "react";

export const runtime = "edge";

/**
 * Logo 300×300 per **Garmin Connect Developer** (URL app / partner verification).
 * Allinea il portale a questo host Pro 2, non a `nextjs-empathy-pro.vercel.app`.
 */
export async function GET() {
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "300px",
          height: "300px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#1f254b",
          fontFamily: "Inter, Arial, sans-serif",
          position: "relative",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: "148px",
            height: "148px",
            borderRadius: "999px",
            border: "18px solid #6c5ce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6c5ce7",
            fontSize: "72px",
            fontStyle: "italic",
            fontWeight: 700,
            lineHeight: 1,
            boxSizing: "border-box",
            marginBottom: "22px",
          },
        },
        "e",
      ),
      React.createElement(
        "div",
        {
          style: {
            fontSize: "52px",
            fontStyle: "italic",
            fontWeight: 400,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: "#1f254b",
          },
        },
        "Empathy",
      ),
    ),
    {
      width: 300,
      height: 300,
    },
  );
}
