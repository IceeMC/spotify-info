export interface Tokens {
	access_token: string;
}

export interface Track {
	track: {
		explicit: boolean;
	}
}

export interface TrackResponse {
	items: Track[];
	next: string | null;
	total: number;
}