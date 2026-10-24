const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { ecoDb, userDb, cooldownDb } = require('../utils/db');
const { successEmbed, warningEmbed } = require('../utils/embedUtils');
const { checkTilsim } = require('../utils/tilsimUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topla')
        .setDescription('Sahip olduğunuz yatırımlardan biriken pasif gelirleri toplar.'),
        
    async execute(interaction) {
        const userId = interaction.user.id;
        const envanter = userDb.bul(`envanter_${userId}`) || [];
        
        // Kullanıcının yatırımlarını filtrele
        const yatirimlar = envanter.filter(e => e.kategori === 'yatirimlar');

        if (yatirimlar.length === 0) {
            const uyari = warningEmbed(
                interaction.member,
                'Yatırımın Yok!',
                'Şu an sana pasif gelir getirecek hiçbir iş yerin veya yatırımın yok. Önce mağazadan bir şeyler satın almalısın!'
            );
            return interaction.reply({ embeds: [uyari] });
        }

        const sonToplama = cooldownDb.bul(`topla_${userId}`);
        const SU_AN = Date.now();

        // İlk kez topluyorsa veya kaydı yoksa
        if (!sonToplama) {
            cooldownDb.ayarla(`topla_${userId}`, SU_AN);
            const ilkKurulumEmbed = warningEmbed(
                interaction.member,
                'İşletmeler Yeni Açıldı!',
                'Yeni aldığın işletmelerin kasası henüz bomboş. Çalışmaya yeni başladılar, para birikmesi için biraz zaman geçmesini beklemelisin!'
            );
            return interaction.reply({ embeds: [ilkKurulumEmbed] });
        }

        const baslangicZamani = sonToplama;
        let gecenMilisaniye = SU_AN - baslangicZamani;

        // MAX BİRİKME SÜRESİ: 24 SAAT (Depo dolar)
        const MAX_SURE = 24 * 60 * 60 * 1000;
        let depoDolduMu = false;

        if (gecenMilisaniye > MAX_SURE) {
            gecenMilisaniye = MAX_SURE;
            depoDolduMu = true;
        }

        const gecenSaat = gecenMilisaniye / (1000 * 60 * 60);

        // Shop.json'dan verileri çek
        const shopPath = path.join(__dirname, '..', 'config', 'shop.json');
        const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));
        
        let toplamKazanilan = 0;
        let isletmeIsimleri = [];
        let felaketMesajlari = [];

        const SEVIYE_TABLOSU = {
            1: 1.0,
            2: 1.75,
            3: 2.5,
            4: 3.5,
            5: 5.0
        };

        for (const y of yatirimlar) {
            const gercekVeri = shopData.yatirimlar.find(s => s.id === y.id);
            if (gercekVeri && gercekVeri.saatlikGelir) {
                const seviye = y.seviye || 1;
                const seviyeGelirCarpani = SEVIYE_TABLOSU[seviye] || 1.0;
                const tabanGelir = gercekVeri.saatlikGelir * seviyeGelirCarpani;

                isletmeIsimleri.push(`${gercekVeri.isim} (Lvl ${seviye})`);
                
                // Bireysel Risk Kontrolü (Seviye arttıkça arıza ihtimali azalır)
                const riskOrani = Math.max(0.01, (gercekVeri.riskOrani || 0) - ((seviye - 1) * 0.01));
                if (Math.random() < riskOrani) {
                    felaketMesajlari.push(`⚠️ **${gercekVeri.isim} (Lvl ${seviye}):** ${gercekVeri.riskMesaji}`);
                    // Bu işletme patladığı için bu seferlik para getirmez
                } else {
                    toplamKazanilan += tabanGelir * gecenSaat;
                }
            }
        }

        // Tılsım Bonusu (Bereket Tılsımı +%25 hasılat)
        const bereket = checkTilsim(userId, 'gelir');
        if (bereket) {
            toplamKazanilan *= (1 + (bereket.bonusYuzde / 100));
        }

        const kazanilanPara = Math.floor(toplamKazanilan);

        // Hem para 1'den küçükse, hem de felaket de olmamışsa bekle
        if (kazanilanPara < 1 && felaketMesajlari.length === 0) {
            const beklemeEmbed = warningEmbed(
                interaction.member,
                'Kasa Henüz Boş',
                `İşletmelerinde henüz toplanacak kadar para (1 🪙 bile) birikmemiş. En son <t:${Math.floor(baslangicZamani / 1000)}:R> topladın, biraz daha zaman geçmesini bekle!`
            );
            return interaction.reply({ embeds: [beklemeEmbed] });
        }

        // Parayı ver ve zamanı sıfırla
        ecoDb.ekle(`cuzdan_${userId}`, kazanilanPara);
        cooldownDb.ayarla(`topla_${userId}`, SU_AN);

        let aciklama = `İşletmelerini gezdin ve hasılatı topladın!\n\n`;
        aciklama += `💼 **İşletmelerin:** ${isletmeIsimleri.join(', ')}\n`;
        aciklama += `⏱ **Geçen Süre:** ${(gecenSaat).toFixed(1)} Saat\n`;
        aciklama += `💸 **Toplanan Nakit:** **${kazanilanPara.toLocaleString()} 🪙**\n\n`;

        if (felaketMesajlari.length > 0) {
            aciklama += `🚨 **Günün Kötü Haberleri (Maddi Kayıp):**\n${felaketMesajlari.join('\n')}\n\n`;
        }

        if (depoDolduMu) {
            aciklama += `⚠️ *Uyarı: Uzun süredir uğramadığın için kasalar dolmuştu (Max 24 Saat). Daha sık uğramaya çalış!*`;
        }

        const basariEmbed = successEmbed(
            interaction.member,
            'Hasılat Toplandı!',
            aciklama
        );

        await interaction.reply({ embeds: [basariEmbed] });
    }
};
