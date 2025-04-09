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

export function tagNews(title: string, summary: string) {
	const text = (title + ' ' + summary).toLowerCase();
	const tags: { category: string; coins: string[] } = { category: '其他', coins: [] };

	// 類別標記
	if (text.includes('listing') || text.includes('launch')) tags.category = '上幣';
	else if (text.includes('hack') || text.includes('security') || text.includes('breach')) tags.category = '黑客';
	else if (text.includes('regulation') || text.includes('sec') || text.includes('ban')) tags.category = '監管';
	else if (text.includes('partnership') || text.includes('collaboration')) tags.category = '合作';

	// 幣種標記
	if (text.includes('btc') || text.includes('bitcoin')) tags.coins.push('BTC');
	if (text.includes('eth') || text.includes('ethereum')) tags.coins.push('ETH');
	if (text.includes('xrp')) tags.coins.push('XRP');
	if (text.includes('sol') || text.includes('solana')) tags.coins.push('SOL');

	return tags;
}
