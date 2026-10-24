const { SlashCommandBuilder } = require('discord.js');
const { ecoDb } = require('../utils/db');
const { customEmbed } = require('../utils/embedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bakiye')
        .setDescription('Sizin veya başkasının bakiye bilgisini gösterir.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Bakiyesine bakmak istediğiniz kullanıcı (Opsiyonel)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
        const { userDb } = require('../utils/db');
        
        const targetMember = interaction.options.getMember('kullanici') || interaction.member;
        const userId = targetMember.user.id;

        let bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const banka = ecoDb.bul(`banka_${userId}`);
        
        if (banka && banka > 0) {
            bakiye += banka;
            ecoDb.ayarla(`cuzdan_${userId}`, bakiye);
            ecoDb.sil(`banka_${userId}`);
        }

        const piyasa = ecoDb.bul('borsa_piyasa') || {};
        const cuzdan = userDb.bul(`portfoy_${userId}`) || {};
        
        const VARLIKLAR = {
            'usd': '💵 Dolar',
            'altin': '🥇 Altın',
            'btc': '₿ Bitcoin',
            'vex': '🚀 Vexora Coin'
        };

        let portfoyYazisi = '';
        let toplamDeger = 0;
        let toplamMaliyet = 0;

        for (const key in VARLIKLAR) {
            let veri = cuzdan[key];
            if (!veri) continue;
            
            let adet = typeof veri === 'number' ? veri : veri.adet;
            let maliyet = typeof veri === 'number' ? adet * (piyasa[key] ? piyasa[key].fiyat : 0) : veri.maliyet;

            if (adet > 0 && piyasa[key]) {
                const deger = adet * piyasa[key].fiyat;
                toplamDeger += deger;
                toplamMaliyet += maliyet;
                
                const karZarar = deger - maliyet;
                let durum = karZarar >= 0 ? `🟢 +${Math.floor(karZarar).toLocaleString()}` : `🔴 ${Math.ceil(karZarar).toLocaleString()}`;
                
                portfoyYazisi += `**${VARLIKLAR[key]}:** ${adet.toLocaleString()} adet (Değer: ${Math.floor(deger).toLocaleString()} 🪙 | K/Z: ${durum})\n`;
            }
        }

        if (portfoyYazisi === '') {
            portfoyYazisi = '*Şu an herhangi bir borsa/kripto yatırımınız bulunmuyor.*';
        } else {
            const toplamKZ = toplamDeger - toplamMaliyet;
            let genelDurum = toplamKZ >= 0 ? `🟢 +${Math.floor(toplamKZ).toLocaleString()}` : `🔴 ${Math.ceil(toplamKZ).toLocaleString()}`;
            portfoyYazisi += `\n**📊 Toplam Portföy Değeri:** ${Math.floor(toplamDeger).toLocaleString()} 🪙 (Genel K/Z: ${genelDurum})`;
        }

        const container = new ContainerBuilder().setAccentColor(0x2ecc71);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 💰 ${targetMember.displayName} - Bakiye ve Yatırımlar\n**Nakit Bakiye:** ${bakiye.toLocaleString()} 🪙`)
        );
        
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 📈 Döviz & Borsa Bilgileri\n${portfoyYazisi}`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`*Yatırım yapmak için /borsa komutunu kullanabilirsiniz.*`)
        );

        await interaction.reply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2 
        });
    },
};
