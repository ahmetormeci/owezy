Pod::Spec.new do |s|
  s.name           = 'ReceiptOcr'
  s.version        = '1.0.0'
  s.summary        = 'Fisten metin okur ve her parcanin KONUMUNU da dondurur'
  s.description    = 'Apple Vision ile metin tanima; bounding box korunuyor.'
  s.author         = 'Owezy'
  s.homepage       = 'https://owezy.net'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
