import { Hono } from 'hono';
import { GoogleGenAI } from '@google/genai';

// Define the expected environment variables
interface Env {
	AI_COMMENT_FUNCTION_URL: string;
}

const CommentByAI = async (title: string, summary: string, apiKey: string) => {
	const genAI = new GoogleGenAI({ apiKey });
	const response = await genAI.models.generateContent({
		model: 'gemini-1.5-flash',
		contents: `你是穿越時空的炒幣 degen 孫子兵法裡的孫武, 請用最多兩段文字盡可能簡潔的評論這則新聞: ${title} ${summary}`,
	});
	const text = response.text ?? '';
	return text;
};

const app = new Hono<{ Bindings: Env }>();

app.post('/', async (c) => {
	console.log('Received request headers:', JSON.stringify(c.req.header()));

	try {
		const payload = await c.req.json();
		console.log('Received Supabase webhook payload:');
		console.log(JSON.stringify(payload, null, 2));

		// Basic check for an INSERT event
		if (payload.type === 'INSERT' && payload.table && payload.record) {
			console.log(`Detected INSERT into table: ${payload.table}`);

			// Extract relevant data (adjust based on your actual table structure)
			const recordId = payload.record.id; // Assuming your table has an 'id' column
			const recordData = payload.record; // Or specific fields you need

			if (!recordId) {
				console.error('Could not find record ID in the payload.');
				return c.json({ error: 'Missing record ID in payload' }, 400);
			}

			console.log(`Triggering AI comment function for record ID: ${recordId}`);

			// Prepare data to send to the AI comment function
			const aiPayload = {
				supabase_record_id: recordId,
				data: recordData, // Send the whole record or specific parts
				// Add any other necessary context
			};

			// Trigger the AI comment function (replace with actual fetch logic)
			const aiFunctionUrl = c.env.AI_COMMENT_FUNCTION_URL;
			if (!aiFunctionUrl) {
				console.error('AI_COMMENT_FUNCTION_URL environment variable is not set.');
				return c.json({ error: 'AI function URL not configured' }, 500);
			}

			try {
				const response = await fetch(aiFunctionUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						// Add any necessary authentication headers for your AI function
					},
					body: JSON.stringify(aiPayload),
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`Error calling AI comment function: ${response.status} ${response.statusText}`, errorText);
					return c.json({ error: 'Failed to trigger AI comment function', details: errorText });
				}

				const result = await response.json();
				console.log('AI comment function response:', result);
				return c.json({ success: true, message: 'AI function triggered', ai_response: result });
			} catch (fetchError) {
				console.error('Error fetching AI comment function:', fetchError);
				return c.json({ error: 'Failed to fetch AI comment function' }, 500);
			}
		} else {
			console.log('Not an INSERT event or missing required payload fields.');
			return c.json({ message: 'Payload received, but not a relevant INSERT event.' });
		}
	} catch (error) {
		console.error('Error processing request:', error);
		// Attempt to read as text if JSON parsing fails
		try {
			const textPayload = await c.req.text();
			console.log('Received non-JSON payload:', textPayload);
			return c.json({ error: 'Invalid JSON payload received', body: textPayload }, 400);
		} catch (textError) {
			console.error('Error reading request body as text:', textError);
			return c.json({ error: 'Failed to read request body' }, 400);
		}
	}
});

export default app;
