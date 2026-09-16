/**
 * Reliquat du starter Next.js — route API exemple non utilisée par Blog Maker.
 * Retourne un JSON statique { name: "John Doe" }.
 */
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  res.status(200).json({ name: "John Doe" });
}
