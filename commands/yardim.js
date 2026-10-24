const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder,
    MessageFlags
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yardım')
        .setDescription('Botun sahip olduğu bütün ekonomi, borsa ve casino komutlarını detaylıca gösterir.'),
        
    async execute(interaction) {
        
        const container = new ContainerBuilder().setAccentColor(0x9b59b6);
        
        // Ana Başlık
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 📖 VEXORA Ekonomi Sistem Rehberi\nSunucunun canlı ve değişken ekonomisinde kullanabileceğiniz tüm komutlar aşağıda kategorize edilmiştir. Tüm komutları **!** (ünlem) veya **/** (eğik çizgi) ile kullanabilirsiniz.`)
        );
        
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Ekonomi & İş & Yatırım
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 💼 İş & Ekonomi & Yatırım\n**\`/çalış\`** - Mesleğinize göre çalışarak para kazanırsınız. Dikkat edin, işler ters gidebilir! (10 Dk Cooldown)\n**\`/bakiye\`** - Cüzdanınızdaki nakit parayı, yatırımlarınızı ve toplam servetinizi gösterir.\n**\`/profil\`** - Sizin veya başkasının kariyerini, servetini ve yatırımlarını şık bir şekilde listeler.\n**\`/zenginler\`** - Sunucudaki en zengin 10 oyuncuyu (Nakit + Borsa serveti ile) listeler.\n**\`/mağaza\`** - Bakiye ile meslek, pasif gelir getiren işletme (yatırım) ve özel roller alırsınız.\n**\`/yükselt\`** - Sahip olduğunuz işletmeleri Level 5'e kadar yükseltip pasif kazancınızı katlarsınız.\n**\`/topla\`** - Mağazadan aldığınız işletmelerin kasasında biriken kârı (pasif geliri) toplarsınız.\n**\`/transfer <kullanıcı> <miktar>\`** - Başka bir oyuncuya nakit para gönderirsiniz.`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Borsa & Yatırım
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 📈 Borsa & Kripto\n**\`/borsa\`** - Gerçek zamanlı yatırım yapmanızı sağlar. Fiyatlar her **30 dakikada bir** piyasa koşullarına göre rastgele dalgalanır.\n\n*Ayrıca arz-talep sistemi aktiftir! Oyuncular çok alım yaparsa fiyat anında artar, çok satım yaparsa fiyat anında düşer.*`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Casino & Oyunlar
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🎰 Casino & Kumarhaneler\n**\`/oyunlar\`** - Tüm casino oyunlarını tek menüde gösterir ve kolayca bahis yapmanızı sağlar.\n**\`/düello\`** - Bota veya etiketlediğiniz bir arkadaşınıza karşı sıra tabanlı düello yapın!\n**\`/kazı-kazan\`** - 9 kapalı butonu kazıyarak 3 aynı sembolü bulmaya çalıştığınız efsanevi şans oyunu.\n**\`/at-yarışı\`** - Seçtiğiniz atın 1. gelmesi için dua ettiğiniz canlı yarış simülatörü.\n**\`/slot\`** - Klasik slot makinesi. Büyük ikramiyeyi (Jackpot) vurursanız paranızı 15'e katlar!\n**\`/21\`** (Blackjack) - Kurpiyere karşı 21'e ulaşmaya çalışın.\n**\`/mayın-tarlası\`** - Mayınlara basmadan altınları toplayın. Ne kadar çok altın, o kadar büyük kâr.\n**\`/büyük-küçük\`** (Highlow) - Çıkan sayının 50'den büyük mü yoksa küçük mü olacağını tahmin edin.\n**\`/yazı-tura\`** - Klasik 50/50 kumarı. Para havada dönerken heyecanı hissedin.`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Eğlence & Sosyal
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🎭 Eğlence & Sosyal\n**\`/tokatla\`** - Etiketlediğiniz kişiyi tokatlarsınız. (100 🪙)\n**\`/kırbaçla\`** - Şlaaak! İstediğiniz kişiyi kırbaçlarsınız. (200 🪙)\n**\`/sarıl\`** - Etiketlediğiniz kişiye sımsıkı sarılırsınız. (50 🪙)\n**\`/öp\`** - Etiketlediğiniz kişiyi öpersiniz. (150 🪙)\n**\`/evlen\`** - Envanterinizdeki yüzükle birine evlenme teklif edersiniz.\n**\`/boşan\`** - Eşinizden ayrılırsınız. (Avukat Masrafı: 5.000 🪙)\n**\`/dua <kullanıcı>\`** - Her 12 saatte bir dostunuz için dua ederek onun kader havuzuna kalıcı +1 Dua Puanı (+%2 kalıcı şans) kazandırırsınız.\n**\`/lanet <kullanıcı>\`** - 10.000 🪙 karşılığı birine kara büyü yaparak kader havuzunu kalıcı -1 Lanet Puanı (-%2 şans) düşürürsünüz! (12 Saat Cooldown)`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // RPG Sistemleri (Level ve Evlilik)
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🌟 RPG & Gelişim Sistemleri\n**Kariyer Seviyesi:** Her \`!çalış\` komutu kullandığınızda karakteriniz XP kazanır ve seviye atlar. Maksimum seviye 5'tir. Her seviye atladığınızda maaşınıza kalıcı **%2.5 Bonus** eklenir (Max %10).\n\n**Evlilik & Yüzüğün Gücü:** Mağazadan satın aldığınız yüzükle birine teklif edip evlendiğinizde, yüzüğün kalitesi kadar (Örn: Pembe Elmas %40) maaşınıza kalıcı **Aşk Bonusu** yansır. Boşanırsanız bu gücü kaybedersiniz!`)
        );

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Dipnot
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`*İpucu: Mağazadan meslek alırken en düşük meslekten başlayarak terfi etmeniz gerekmektedir.*`)
        );

        await interaction.reply({ 
            components: [container], 
            flags: MessageFlags.IsComponentsV2 
        });
    },
};
