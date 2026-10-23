import ProductEditorClient from '../product-editor-client'

type EditProductPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params

  return (
    <ProductEditorClient productId={id} />
  )
}
