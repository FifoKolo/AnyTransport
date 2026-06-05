<?php

function site_content_make_link($id, $label, $href, $order, $pageId = '') {
    return array(
        'id' => $id,
        'label' => $label,
        'href' => $href,
        'visible' => true,
        'order' => $order,
        'pageId' => $pageId !== '' ? $pageId : $id
    );
}

function get_default_site_content() {
    $navbarLinks = array(
        site_content_make_link('about', 'About Us', '#about', 1, 'about'),
        site_content_make_link('services', 'Our Services', '#services', 2, 'services'),
        site_content_make_link('how-it-works', 'How it Works', '#how-it-works', 3, 'how-it-works'),
        site_content_make_link('pricing', 'Pricing', '#pricing', 4, 'pricing'),
        site_content_make_link('faq', 'FAQ', '#faq', 5, 'faq'),
        site_content_make_link('find-providers', 'Find providers', 'find-providers.html', 6, ''),
        site_content_make_link('contact', 'Contact Us', '#contact', 7, 'contact')
    );

    $footerColumns = array(
        array(
            'id' => 'company',
            'title' => 'Company',
            'links' => array(
                array('id' => 'fc-about', 'label' => 'About Us', 'href' => '#about', 'visible' => true),
                array('id' => 'fc-contact', 'label' => 'Contact Us', 'href' => '#contact', 'visible' => true),
                array('id' => 'fc-careers', 'label' => 'Careers', 'href' => '#careers', 'visible' => true),
                array('id' => 'fc-partners', 'label' => 'Partners', 'href' => '#partners', 'visible' => true)
            )
        ),
        array(
            'id' => 'services',
            'title' => 'Services',
            'links' => array(
                array('id' => 'fc-man-van', 'label' => 'Man With Van', 'href' => '#man-van', 'visible' => true),
                array('id' => 'fc-removals', 'label' => 'Removals', 'href' => '#removals', 'visible' => true),
                array('id' => 'fc-vehicle', 'label' => 'Vehicle Transport', 'href' => '#vehicle', 'visible' => true),
                array('id' => 'fc-international', 'label' => 'International Movers', 'href' => '#international', 'visible' => true)
            )
        ),
        array(
            'id' => 'resources',
            'title' => 'Resources',
            'links' => array(
                array('id' => 'fc-faq', 'label' => 'FAQs', 'href' => '#faq', 'visible' => true),
                array('id' => 'fc-help', 'label' => 'Help Centre', 'href' => '#help', 'visible' => true),
                array('id' => 'fc-blog', 'label' => 'Blogs', 'href' => '#blog', 'visible' => true)
            )
        )
    );

    $defaultPage = function ($id, $title, $html) {
        return array(
            'id' => $id,
            'slug' => $id,
            'title' => $title,
            'subtitle' => '',
            'headingFont' => '',
            'bodyFont' => '',
            'heroImage' => '',
            'visible' => true,
            'blocks' => array(
                array('type' => 'html', 'content' => $html)
            )
        );
    };

    return array(
        'version' => 1,
        'updatedAt' => '',
        'navbar' => array(
            'logoText' => 'AnyTransport',
            'logoSrc' => 'assets/logo.jpeg',
            'links' => $navbarLinks
        ),
        'footer' => array(
            'brand' => array(
                'logoText' => 'AnyTransport',
                'logoSrc' => 'assets/logo.jpeg',
                'description' => "We're here to make moving anything easier, more affordable, and greener for everyone. And we're pretty good at it too - just ask the furniture."
            ),
            'social' => array(
                array('id' => 'social-fb', 'label' => 'Facebook', 'href' => '#', 'visible' => true),
                array('id' => 'social-ig', 'label' => 'Instagram', 'href' => '#', 'visible' => true),
                array('id' => 'social-tw', 'label' => 'Twitter', 'href' => '#', 'visible' => true)
            ),
            'columns' => $footerColumns,
            'copyright' => '© 2005-2026 AnyTransport Ltd. All rights reserved',
            'bottomLinks' => array(
                array('id' => 'bl-privacy', 'label' => 'Privacy', 'href' => '#privacy', 'visible' => true),
                array('id' => 'bl-terms', 'label' => 'Terms of Use', 'href' => '#terms', 'visible' => true),
                array('id' => 'bl-provider', 'label' => 'Transport Provider Sign Up', 'href' => '#provider-signup', 'visible' => true, 'action' => 'provider-signup'),
                array('id' => 'bl-sitemap', 'label' => 'Sitemap', 'href' => '#sitemap', 'visible' => true)
            )
        ),
        'pages' => array(
            'about' => $defaultPage('about', 'About Us', '<p>AnyTransport connects customers with trusted transport providers across Ireland. We make it simple to compare quotes and book the right move for your job.</p>'),
            'pricing' => $defaultPage('pricing', 'Pricing', '<p>Pricing depends on distance, item size, and service type. Post your job for free and compare provider quotes with no obligation.</p>'),
            'faq' => $defaultPage('faq', 'Frequently Asked Questions', '<p><strong>How do I get a quote?</strong><br>Create a listing on our site and providers will send you quotes.</p><p><strong>Is it free to post a job?</strong><br>Yes — posting a transport request is free for customers.</p>'),
            'contact' => $defaultPage('contact', 'Contact Us', '<p>Email us at <a href="mailto:info@anytransport.ie">info@anytransport.ie</a> or use the contact form on this page.</p>'),
            'careers' => $defaultPage('careers', 'Careers', '<p>Interested in joining AnyTransport? Send your CV to info@anytransport.ie.</p>'),
            'partners' => $defaultPage('partners', 'Partners', '<p>We partner with transport providers and businesses across Ireland. Contact us to discuss partnership opportunities.</p>'),
            'help' => $defaultPage('help', 'Help Centre', '<p>Need help using AnyTransport? Browse our FAQ or contact support at info@anytransport.ie.</p>'),
            'blog' => $defaultPage('blog', 'Blog', '<p>News and tips about moving, transport, and logistics — coming soon.</p>'),
            'privacy' => $defaultPage('privacy', 'Privacy Policy', '<p>Your privacy matters to us. This page describes how AnyTransport collects and uses your information.</p>'),
            'terms' => $defaultPage('terms', 'Terms of Use', '<p>By using AnyTransport you agree to our terms of service. Please read this page carefully.</p>'),
            'sitemap' => $defaultPage('sitemap', 'Sitemap', '<p>Main sections: About, Services, How it Works, Pricing, FAQ, and Contact.</p>'),
            'man-van' => $defaultPage('man-van', 'Man With Van', '<p>Book a man-with-van service for small moves, single items, and local deliveries.</p>'),
            'removals' => $defaultPage('removals', 'Removals', '<p>House and office removals with experienced transport providers.</p>'),
            'vehicle' => $defaultPage('vehicle', 'Vehicle Transport', '<p>Move cars, vans, motorbikes, and other vehicles safely across Ireland.</p>'),
            'international' => $defaultPage('international', 'International Movers', '<p>International moving services for relocations abroad.</p>')
        ),
        'theme' => array(
            'headingFont' => '',
            'bodyFont' => ''
        )
    );
}

function normalize_site_nav_link($link, $fallbackId = '') {
    if (!is_array($link)) {
        return null;
    }
    $id = trim((string) ($link['id'] ?? $fallbackId));
    if ($id === '') {
        $id = make_id('nav');
    }
    $label = trim((string) ($link['label'] ?? ''));
    if ($label === '') {
        return null;
    }
    return array(
        'id' => $id,
        'label' => $label,
        'href' => trim((string) ($link['href'] ?? '#')),
        'visible' => !array_key_exists('visible', $link) || !empty($link['visible']),
        'order' => (int) ($link['order'] ?? 0),
        'pageId' => trim((string) ($link['pageId'] ?? '')),
        'action' => trim((string) ($link['action'] ?? ''))
    );
}

function normalize_site_footer_link($link, $fallbackId = '') {
    if (!is_array($link)) {
        return null;
    }
    $id = trim((string) ($link['id'] ?? $fallbackId));
    if ($id === '') {
        $id = make_id('flink');
    }
    $label = trim((string) ($link['label'] ?? ''));
    if ($label === '') {
        return null;
    }
    return array(
        'id' => $id,
        'label' => $label,
        'href' => trim((string) ($link['href'] ?? '#')),
        'visible' => !array_key_exists('visible', $link) || !empty($link['visible']),
        'action' => trim((string) ($link['action'] ?? ''))
    );
}

function normalize_site_page_block($block) {
    if (!is_array($block)) {
        return null;
    }
    $type = strtolower(trim((string) ($block['type'] ?? 'html')));
    if ($type === 'image') {
        $url = trim((string) ($block['url'] ?? ''));
        if ($url === '') {
            return null;
        }
        return array(
            'type' => 'image',
            'url' => $url,
            'caption' => trim((string) ($block['caption'] ?? '')),
            'alt' => trim((string) ($block['alt'] ?? ''))
        );
    }
    $content = trim((string) ($block['content'] ?? ''));
    if ($content === '') {
        return null;
    }
    return array(
        'type' => 'html',
        'content' => $content
    );
}

function normalize_site_page($page, $fallbackId = '') {
    if (!is_array($page)) {
        return null;
    }
    $id = trim((string) ($page['id'] ?? $fallbackId));
    if ($id === '') {
        return null;
    }
    $blocks = array();
    foreach ((array) ($page['blocks'] ?? array()) as $block) {
        $normalizedBlock = normalize_site_page_block($block);
        if ($normalizedBlock !== null) {
            $blocks[] = $normalizedBlock;
        }
    }
    if (!$blocks) {
        $blocks[] = array('type' => 'html', 'content' => '<p>Content coming soon.</p>');
    }
    return array(
        'id' => $id,
        'slug' => trim((string) ($page['slug'] ?? $id)) ?: $id,
        'title' => trim((string) ($page['title'] ?? $id)),
        'subtitle' => trim((string) ($page['subtitle'] ?? '')),
        'headingFont' => trim((string) ($page['headingFont'] ?? '')),
        'bodyFont' => trim((string) ($page['bodyFont'] ?? '')),
        'heroImage' => trim((string) ($page['heroImage'] ?? '')),
        'visible' => !array_key_exists('visible', $page) || !empty($page['visible']),
        'blocks' => $blocks
    );
}

function normalize_site_content($content) {
    $defaults = get_default_site_content();
    if (!is_array($content)) {
        return $defaults;
    }

    $navbarIn = is_array($content['navbar'] ?? null) ? $content['navbar'] : array();
    $navbarLinks = array();
    foreach ((array) ($navbarIn['links'] ?? array()) as $idx => $link) {
        $normalized = normalize_site_nav_link($link, 'nav-' . $idx);
        if ($normalized !== null) {
            $navbarLinks[] = $normalized;
        }
    }
    if (!$navbarLinks) {
        $navbarLinks = $defaults['navbar']['links'];
    }
    usort($navbarLinks, function ($a, $b) {
        return ($a['order'] ?? 0) <=> ($b['order'] ?? 0);
    });

    $footerIn = is_array($content['footer'] ?? null) ? $content['footer'] : array();
    $brandIn = is_array($footerIn['brand'] ?? null) ? $footerIn['brand'] : array();
    $social = array();
    foreach ((array) ($footerIn['social'] ?? array()) as $idx => $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = trim((string) ($item['id'] ?? 'social-' . $idx));
        $label = trim((string) ($item['label'] ?? ''));
        if ($label === '') {
            continue;
        }
        $social[] = array(
            'id' => $id,
            'label' => $label,
            'href' => trim((string) ($item['href'] ?? '#')),
            'visible' => !array_key_exists('visible', $item) || !empty($item['visible'])
        );
    }
    if (!$social) {
        $social = $defaults['footer']['social'];
    }

    $columns = array();
    foreach ((array) ($footerIn['columns'] ?? array()) as $idx => $column) {
        if (!is_array($column)) {
            continue;
        }
        $colId = trim((string) ($column['id'] ?? 'col-' . $idx));
        $title = trim((string) ($column['title'] ?? ''));
        if ($title === '') {
            continue;
        }
        $links = array();
        foreach ((array) ($column['links'] ?? array()) as $lidx => $link) {
            $normalizedLink = normalize_site_footer_link($link, $colId . '-link-' . $lidx);
            if ($normalizedLink !== null) {
                $links[] = $normalizedLink;
            }
        }
        $columns[] = array('id' => $colId, 'title' => $title, 'links' => $links);
    }
    if (!$columns) {
        $columns = $defaults['footer']['columns'];
    }

    $bottomLinks = array();
    foreach ((array) ($footerIn['bottomLinks'] ?? array()) as $idx => $link) {
        $normalizedLink = normalize_site_footer_link($link, 'bottom-' . $idx);
        if ($normalizedLink !== null) {
            $bottomLinks[] = $normalizedLink;
        }
    }
    if (!$bottomLinks) {
        $bottomLinks = $defaults['footer']['bottomLinks'];
    }

    $pagesIn = is_array($content['pages'] ?? null) ? $content['pages'] : array();
    $pages = array();
    foreach ($pagesIn as $pageId => $page) {
        $normalizedPage = normalize_site_page($page, is_string($pageId) ? $pageId : '');
        if ($normalizedPage !== null) {
            $pages[$normalizedPage['id']] = $normalizedPage;
        }
    }
    foreach ($defaults['pages'] as $pageId => $page) {
        if (!isset($pages[$pageId])) {
            $pages[$pageId] = $page;
        }
    }

    $themeIn = is_array($content['theme'] ?? null) ? $content['theme'] : array();
    return array(
        'version' => 1,
        'updatedAt' => trim((string) ($content['updatedAt'] ?? '')),
        'navbar' => array(
            'logoText' => trim((string) ($navbarIn['logoText'] ?? $defaults['navbar']['logoText'])),
            'logoSrc' => trim((string) ($navbarIn['logoSrc'] ?? $defaults['navbar']['logoSrc'])),
            'links' => $navbarLinks
        ),
        'footer' => array(
            'brand' => array(
                'logoText' => trim((string) ($brandIn['logoText'] ?? $defaults['footer']['brand']['logoText'])),
                'logoSrc' => trim((string) ($brandIn['logoSrc'] ?? $defaults['footer']['brand']['logoSrc'])),
                'description' => trim((string) ($brandIn['description'] ?? $defaults['footer']['brand']['description']))
            ),
            'social' => $social,
            'columns' => $columns,
            'copyright' => trim((string) ($footerIn['copyright'] ?? $defaults['footer']['copyright'])),
            'bottomLinks' => $bottomLinks
        ),
        'pages' => $pages,
        'theme' => array(
            'headingFont' => trim((string) ($themeIn['headingFont'] ?? '')),
            'bodyFont' => trim((string) ($themeIn['bodyFont'] ?? ''))
        )
    );
}

function get_site_content_from_store($store) {
    $stored = isset($store['siteContent']) ? $store['siteContent'] : null;
    return normalize_site_content($stored);
}

function build_site_media_url($mediaId) {
    $script = isset($_SERVER['SCRIPT_NAME']) ? (string) $_SERVER['SCRIPT_NAME'] : '/api/index.php';
    return $script . '?action=site.media&id=' . rawurlencode($mediaId);
}

function sanitize_site_content_html($html) {
    $text = (string) $html;
    $text = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $text);
    $text = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $text);
    $text = preg_replace('/\son\w+\s*=\s*(["\']).*?\1/i', '', $text);
    $text = preg_replace('/\son\w+\s*=\s*[^\s>]+/i', '', $text);
    $text = preg_replace('/javascript:/i', '', $text);
    return trim($text);
}
