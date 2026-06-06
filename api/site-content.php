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

function site_content_page_href($slug) {
    return 'page.html#' . trim((string) $slug);
}

function get_default_site_content() {
    $navbarLinks = array(
        site_content_make_link('about', 'About Us', site_content_page_href('about'), 1, 'about'),
        site_content_make_link('services', 'Our Services', '#services', 2, 'services'),
        site_content_make_link('how-it-works', 'How it Works', '#how-it-works', 3, 'how-it-works'),
        site_content_make_link('pricing', 'Pricing', site_content_page_href('pricing'), 4, 'pricing'),
        site_content_make_link('faq', 'FAQ', site_content_page_href('faq'), 5, 'faq'),
        site_content_make_link('find-providers', 'Find providers', 'find-providers.html', 6, ''),
        site_content_make_link('contact', 'Contact Us', site_content_page_href('contact'), 7, 'contact')
    );

    $footerColumns = array(
        array(
            'id' => 'company',
            'title' => 'Company',
            'links' => array(
                array('id' => 'fc-about', 'label' => 'About Us', 'href' => site_content_page_href('about'), 'visible' => true),
                array('id' => 'fc-contact', 'label' => 'Contact Us', 'href' => site_content_page_href('contact'), 'visible' => true),
                array('id' => 'fc-careers', 'label' => 'Careers', 'href' => site_content_page_href('careers'), 'visible' => true),
                array('id' => 'fc-partners', 'label' => 'Partners', 'href' => site_content_page_href('partners'), 'visible' => true)
            )
        ),
        array(
            'id' => 'services',
            'title' => 'Services',
            'links' => array(
                array('id' => 'fc-man-van', 'label' => 'Man With Van', 'href' => site_content_page_href('man-van'), 'visible' => true),
                array('id' => 'fc-removals', 'label' => 'Removals', 'href' => site_content_page_href('removals'), 'visible' => true),
                array('id' => 'fc-vehicle', 'label' => 'Vehicle Transport', 'href' => site_content_page_href('vehicle'), 'visible' => true),
                array('id' => 'fc-international', 'label' => 'International Movers', 'href' => site_content_page_href('international'), 'visible' => true)
            )
        ),
        array(
            'id' => 'resources',
            'title' => 'Resources',
            'links' => array(
                array('id' => 'fc-faq', 'label' => 'FAQs', 'href' => site_content_page_href('faq'), 'visible' => true),
                array('id' => 'fc-help', 'label' => 'Help Centre', 'href' => site_content_page_href('help'), 'visible' => true),
                array('id' => 'fc-blog', 'label' => 'Blogs', 'href' => site_content_page_href('blog'), 'visible' => true)
            )
        )
    );

    $defaultPage = function ($id, $title, $html) {
        return array(
            'id' => $id,
            'slug' => $id,
            'title' => $title,
            'visible' => true,
            'canvasHeight' => 520,
            'backgroundColor' => '#ffffff',
            'backgroundImage' => '',
            'elements' => array(
                array(
                    'id' => 'el-' . $id . '-title',
                    'type' => 'title',
                    'content' => $title,
                    'x' => 5,
                    'y' => 6,
                    'width' => 90,
                    'zIndex' => 1,
                    'font' => '',
                    'fontSize' => 34,
                    'color' => '#0f172a',
                    'align' => 'left'
                ),
                array(
                    'id' => 'el-' . $id . '-text',
                    'type' => 'text',
                    'content' => $html,
                    'x' => 5,
                    'y' => 20,
                    'width' => 65,
                    'zIndex' => 2,
                    'font' => '',
                    'fontSize' => 16,
                    'color' => '#334155',
                    'align' => 'left'
                )
            )
        );
    };

    return array(
        'version' => 1,
        'updatedAt' => '',
        'navbar' => array(
            'logoText' => 'AnyTransport',
            'logoSrc' => 'assets/logo.jpeg',
            'logoHref' => 'index.html',
            'backgroundColor' => '',
            'linkColor' => '',
            'links' => $navbarLinks
        ),
        'footer' => array(
            'brand' => array(
                'logoText' => 'AnyTransport',
                'logoSrc' => 'assets/logo.jpeg',
                'description' => "We're here to make moving anything easier, more affordable, and greener for everyone. And we're pretty good at it too - just ask the furniture."
            ),
            'social' => array(
                array('id' => 'social-fb', 'label' => 'Facebook', 'href' => '#', 'visible' => true, 'icon' => 'facebook', 'shape' => 'circle', 'iconText' => 'F', 'iconUrl' => ''),
                array('id' => 'social-ig', 'label' => 'Instagram', 'href' => '#', 'visible' => true, 'icon' => 'instagram', 'shape' => 'circle', 'iconText' => 'I', 'iconUrl' => ''),
                array('id' => 'social-tw', 'label' => 'Twitter', 'href' => '#', 'visible' => true, 'icon' => 'twitter', 'shape' => 'circle', 'iconText' => 'T', 'iconUrl' => '')
            ),
            'columns' => $footerColumns,
            'copyright' => '© 2005-2026 AnyTransport Ltd. All rights reserved',
            'bottomLinks' => array(
                array('id' => 'bl-privacy', 'label' => 'Privacy', 'href' => site_content_page_href('privacy'), 'visible' => true),
                array('id' => 'bl-terms', 'label' => 'Terms of Use', 'href' => site_content_page_href('terms'), 'visible' => true),
                array('id' => 'bl-provider', 'label' => 'Transport Provider Sign Up', 'href' => '#provider-signup', 'visible' => true, 'action' => 'provider-signup'),
                array('id' => 'bl-sitemap', 'label' => 'Sitemap', 'href' => site_content_page_href('sitemap'), 'visible' => true)
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

function normalize_site_social_link($item, $fallbackId = '') {
    if (!is_array($item)) {
        return null;
    }
    $id = trim((string) ($item['id'] ?? $fallbackId));
    if ($id === '') {
        $id = make_id('social');
    }
    $label = trim((string) ($item['label'] ?? ''));
    if ($label === '') {
        return null;
    }
    $allowedIcons = array('facebook', 'instagram', 'twitter', 'x', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'letter', 'custom');
    $allowedShapes = array('circle', 'rounded', 'square');
    $icon = strtolower(trim((string) ($item['icon'] ?? '')));
    if ($icon === 'x') {
        $icon = 'twitter';
    }
    if (!in_array($icon, $allowedIcons, true)) {
        $lowerLabel = strtolower($label);
        $lowerId = strtolower($id);
        if (strpos($lowerLabel, 'face') !== false || strpos($lowerId, 'fb') !== false) {
            $icon = 'facebook';
        } elseif (strpos($lowerLabel, 'insta') !== false || strpos($lowerId, 'ig') !== false) {
            $icon = 'instagram';
        } elseif (strpos($lowerLabel, 'twit') !== false || strpos($lowerId, 'tw') !== false) {
            $icon = 'twitter';
        } elseif (strpos($lowerLabel, 'linked') !== false) {
            $icon = 'linkedin';
        } elseif (strpos($lowerLabel, 'you') !== false || strpos($lowerLabel, 'tube') !== false) {
            $icon = 'youtube';
        } elseif (strpos($lowerLabel, 'tik') !== false) {
            $icon = 'tiktok';
        } elseif (strpos($lowerLabel, 'pin') !== false) {
            $icon = 'pinterest';
        } else {
            $icon = 'letter';
        }
    }
    $shape = strtolower(trim((string) ($item['shape'] ?? 'circle')));
    if (!in_array($shape, $allowedShapes, true)) {
        $shape = 'circle';
    }
    $iconText = trim((string) ($item['iconText'] ?? ''));
    if ($iconText === '') {
        $iconText = strtoupper(substr($label, 0, 1));
    }
    return array(
        'id' => $id,
        'label' => $label,
        'href' => trim((string) ($item['href'] ?? '#')),
        'visible' => !array_key_exists('visible', $item) || !empty($item['visible']),
        'icon' => $icon,
        'shape' => $shape,
        'iconText' => substr($iconText, 0, 2),
        'iconUrl' => trim((string) ($item['iconUrl'] ?? ''))
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

function normalize_site_page_element($element, $fallbackId = '') {
    if (!is_array($element)) {
        return null;
    }
    $id = trim((string) ($element['id'] ?? $fallbackId));
    if ($id === '') {
        $id = make_id('el');
    }
    $type = strtolower(trim((string) ($element['type'] ?? 'text')));
    if (!in_array($type, array('title', 'text', 'image'), true)) {
        $type = 'text';
    }
    $normalized = array(
        'id' => $id,
        'type' => $type,
        'x' => max(0, min(95, (float) ($element['x'] ?? 5))),
        'y' => max(0, min(95, (float) ($element['y'] ?? 5))),
        'width' => $type === 'image'
            ? max(5, min(100, (float) ($element['width'] ?? 40)))
            : max(10, min(100, (float) ($element['width'] ?? 50))),
        'zIndex' => max(1, (int) ($element['zIndex'] ?? 1)),
        'font' => trim((string) ($element['font'] ?? '')),
        'fontSize' => max(10, min(96, (int) ($element['fontSize'] ?? ($type === 'title' ? 32 : 16)))),
        'color' => trim((string) ($element['color'] ?? '#0f172a')),
        'align' => in_array(strtolower(trim((string) ($element['align'] ?? 'left'))), array('left', 'center', 'right'), true)
            ? strtolower(trim((string) ($element['align'] ?? 'left')))
            : 'left'
    );
    if ($type === 'image') {
        $shape = strtolower(trim((string) ($element['shape'] ?? 'rounded')));
        if (!in_array($shape, array('rectangle', 'rounded', 'circle', 'pill'), true)) {
            $shape = 'rounded';
        }
        $objectFit = strtolower(trim((string) ($element['objectFit'] ?? 'cover')));
        if (!in_array($objectFit, array('cover', 'contain', 'fill'), true)) {
            $objectFit = 'cover';
        }
        $height = (float) ($element['height'] ?? 28);
        if ($height <= 0 && $shape === 'circle') {
            $height = 0;
        } elseif ($height <= 0) {
            $height = 28;
        }
        $normalized['url'] = trim((string) ($element['url'] ?? ''));
        $normalized['alt'] = trim((string) ($element['alt'] ?? ''));
        $normalized['height'] = max(0, min(95, $height));
        $normalized['shape'] = $shape;
        $normalized['borderRadius'] = max(0, min(999, (int) ($element['borderRadius'] ?? 12)));
        $normalized['objectFit'] = $objectFit;
        return $normalized;
    }
    $content = trim((string) ($element['content'] ?? ''));
    if ($content === '') {
        return null;
    }
    $normalized['content'] = $content;
    return $normalized;
}

function migrate_site_page_blocks_to_elements($page) {
    $existing = isset($page['elements']) && is_array($page['elements']) ? $page['elements'] : array();
    if ($existing) {
        return $existing;
    }
    $elements = array();
    $y = 6;
    $title = trim((string) ($page['title'] ?? ''));
    if ($title !== '') {
        $elements[] = array(
            'id' => make_id('el'),
            'type' => 'title',
            'content' => $title,
            'x' => 5,
            'y' => $y,
            'width' => 90,
            'zIndex' => 1,
            'font' => trim((string) ($page['headingFont'] ?? '')),
            'fontSize' => 32,
            'color' => '#0f172a',
            'align' => 'left'
        );
        $y += 14;
    }
    foreach ((array) ($page['blocks'] ?? array()) as $block) {
        if (!is_array($block)) {
            continue;
        }
        if (($block['type'] ?? '') === 'image') {
            $url = trim((string) ($block['url'] ?? ''));
            if ($url !== '') {
                $elements[] = array(
                    'id' => make_id('el'),
                    'type' => 'image',
                    'url' => $url,
                    'alt' => trim((string) ($block['alt'] ?? $title)),
                    'x' => 5,
                    'y' => $y,
                    'width' => 40,
                    'height' => 28,
                    'shape' => 'rounded',
                    'borderRadius' => 12,
                    'objectFit' => 'cover',
                    'zIndex' => 1,
                    'font' => '',
                    'fontSize' => 16,
                    'color' => '#0f172a',
                    'align' => 'left'
                );
                $y += 22;
            }
            continue;
        }
        $html = trim((string) ($block['content'] ?? ''));
        if ($html !== '') {
            $elements[] = array(
                'id' => make_id('el'),
                'type' => 'text',
                'content' => $html,
                'x' => 5,
                'y' => $y,
                'width' => 70,
                'zIndex' => 1,
                'font' => trim((string) ($page['bodyFont'] ?? '')),
                'fontSize' => 16,
                'color' => '#334155',
                'align' => 'left'
            );
            $y += 18;
        }
    }
    if (!$elements) {
        $elements[] = array(
            'id' => make_id('el'),
            'type' => 'text',
            'content' => '<p>Click and drag elements anywhere on this page area.</p>',
            'x' => 5,
            'y' => 10,
            'width' => 60,
            'zIndex' => 1,
            'font' => '',
            'fontSize' => 16,
            'color' => '#334155',
            'align' => 'left'
        );
    }
    return $elements;
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
    $elementsIn = migrate_site_page_blocks_to_elements($page);
    $elements = array();
    foreach ($elementsIn as $idx => $element) {
        $normalizedElement = normalize_site_page_element($element, 'el-' . $idx);
        if ($normalizedElement !== null) {
            $elements[] = $normalizedElement;
        }
    }
    if (!$elements) {
        $fallbackElements = migrate_site_page_blocks_to_elements($page);
        foreach ($fallbackElements as $idx => $element) {
            $normalizedElement = normalize_site_page_element($element, 'el-' . $idx);
            if ($normalizedElement !== null) {
                $elements[] = $normalizedElement;
            }
        }
    }
    return array(
        'id' => $id,
        'slug' => trim((string) ($page['slug'] ?? $id)) ?: $id,
        'title' => trim((string) ($page['title'] ?? $id)),
        'visible' => !array_key_exists('visible', $page) || !empty($page['visible']),
        'canvasHeight' => max(320, min(2400, (int) ($page['canvasHeight'] ?? 520))),
        'backgroundColor' => trim((string) ($page['backgroundColor'] ?? '#ffffff')),
        'backgroundImage' => trim((string) ($page['backgroundImage'] ?? '')),
        'elements' => $elements
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
        $normalizedSocial = normalize_site_social_link($item, 'social-' . $idx);
        if ($normalizedSocial) {
            $social[] = $normalizedSocial;
        }
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
            'logoHref' => trim((string) ($navbarIn['logoHref'] ?? $defaults['navbar']['logoHref'] ?? 'index.html')) ?: 'index.html',
            'backgroundColor' => trim((string) ($navbarIn['backgroundColor'] ?? '')),
            'linkColor' => trim((string) ($navbarIn['linkColor'] ?? '')),
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
