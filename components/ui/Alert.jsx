export default function Alert({ as: Tag = 'p', role = 'alert', className = '', children, ...props }) {
  return (
    <Tag className={['rfm-submit-error', className].filter(Boolean).join(' ')} role={role} {...props}>
      {children}
    </Tag>
  );
}
