import {config} from "dotenv";
config();
if (!process.env.ID || !process.env.SECRET) throw new Error("ID and SECRET environmental variables are unset!");
import * as express from "express";
import fetch from "node-fetch";
import {
	TrackResponse,
	Tokens,
	Track
} from "./interfaces";

const id = process.env.ID,
	secret = process.env.SECRET,
	port = process.env.PORT || 8000,
	redirect = `http://localhost:${port}/callback`,
	app = express();

app.use(express.json());

app.get("/", (req, res) => {
	res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${id}&redirect_uri=${encodeURIComponent(redirect)}&scope=user-library-read`)
});

app.get("/callback", async (req, res) => {
	if (!req.query.code) return res.status(400).json({error:"No code provided!"});
	const tokenReq = await fetch(`https://accounts.spotify.com/api/token?grant_type=authorization_code&code=${req.query.code}&redirect_uri=${encodeURIComponent(redirect)}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Authorization": `Basic ${Buffer.from(`${id}:${secret}`, "utf8").toString("base64")}`
		}
	}).catch(() => {
		console.log(`[FETCH ERROR] Failed to request an access token! Try again later!`);
		return res.status(500).send("Failed to get an access token!");
	});
	const tokens: Tokens = await tokenReq.json();
	if (tokens.access_token) {
		const firstTrackReq = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", {
			headers: {
				"Authorization": "Bearer "+tokens.access_token
			}
		});
		const trackRes: TrackResponse = await firstTrackReq.json();
		const tracks: Track[] = trackRes.items;
		if (trackRes.next) {
			console.log(`[FETCH] Start bulk request to get ${trackRes.total} tracks!`);
			let nextUrl = trackRes.next, i = 0;
			while (nextUrl != null) {
				const nextUrlReq = await fetch(nextUrl, { headers: { "Authorization": "Bearer "+tokens.access_token } });
				if (nextUrlReq.ok) {
					i++;
					const json: TrackResponse = await nextUrlReq.json();
					if (json.next) {
						tracks.push(...json.items);
						nextUrl = json.next;
						console.log(`[FETCH] Request ${i} succeeded with ${json.items.length} tracks!`);
					} else {
						nextUrl = null;
						tracks.push(...json.items);
						console.log(`[FETCH] Acquired all ${json.total} (arr length: ${tracks.length}) tracks successfully!`);
					}
				} else {
					console.log(`[FETCH] Request ${i} failed!`);
				}
			}
		}
		const explicit = tracks.filter(x => x.track.explicit).length,
			notExplicit = tracks.filter(x => !x.track.explicit).length;
		console.log(`Explicit tracks: ${explicit} ${Math.round((explicit / tracks.length) * 100)}%`);
		console.log(`Non explicit tracks: ${notExplicit} ${Math.round((notExplicit / tracks.length) * 100)}%`);
		return res.send("");
	}
	res.status(500).json(tokens);
})

app.listen(port, () => console.log(`[SERVER] Server is running!\nVisit http://localhost:${port}`));