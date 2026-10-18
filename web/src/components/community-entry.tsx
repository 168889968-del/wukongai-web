/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { UsersRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'

export function CommunityEntry() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('加入交流群')}
      description={t('扫码加入 QQ 群，获取产品动态与技术支持。')}
      contentClassName='auth-community-dialog sm:max-w-[770px]'
      headerClassName='auth-community-dialog-header'
      titleClassName='auth-community-dialog-title'
      descriptionClassName='auth-community-dialog-description'
      bodyClassName='auth-community-dialog-body'
      trigger={
        <button type='button' className='auth-community-trigger'>
          <UsersRound className='size-4' aria-hidden='true' />
          <span>{t('加入交流群')}</span>
        </button>
      }
    >
      <section className='auth-community-code-card'>
        <div className='auth-community-group-label'>
          <UsersRound className='size-4' aria-hidden='true' />
          <span>{t('悟空Ai学习交流群【QQ群】')}</span>
        </div>
        <div className='auth-community-qr-frame'>
          <img
            src='/wukongai-group-qr.png'
            alt={t('悟空Ai学习交流群 QQ 群二维码')}
          />
        </div>
        <p className='auth-community-group-number'>{t('QQ群号：603378289')}</p>
        <p className='auth-community-hint'>{t('QQ扫码入群，学习交流和售后支持～')}</p>
      </section>
    </Dialog>
  )
}
