export async function sendMessageToTelegram(token: string, chatId: string, message: string) {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const body = JSON.stringify({
		chat_id: chatId,
		text: message,
	});

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body,
		});

		if (!response.ok) {
			console.error('Error sending message to Telegram:', response.status, response.statusText);
		}
	} catch (error) {
		console.error('Error sending message to Telegram:', error);
	}
}
