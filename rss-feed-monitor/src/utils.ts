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

export function tagNews(title: string) {
	const text = title.toLowerCase();
	const tags = [];

	// 類別標記
	if (text.includes('listing') || text.includes('launch')) tags.push('listing');
	if (text.includes('hack') || text.includes('security') || text.includes('breach')) tags.push('hack');
	if (text.includes('regulation') || text.includes('sec') || text.includes('ban')) tags.push('regulation');
	if (text.includes('partnership') || text.includes('collaboration')) tags.push('partnership');

	// 幣種標記
	if (text.includes('btc') || text.includes('bitcoin')) tags.push('BTC');
	if (text.includes('eth') || text.includes('ethereum')) tags.push('ETH');
	if (text.includes('xrp')) tags.push('XRP');
	if (text.includes('sol') || text.includes('solana')) tags.push('SOL');

	return tags;
}
