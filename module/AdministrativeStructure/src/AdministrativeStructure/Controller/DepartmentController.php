<?php

namespace AdministrativeStructure\Controller;

use AdministrativeStructure\Entity\Department;
use AdministrativeStructure\Form\DepartmentForm;
use Database\Service\EntityManagerService;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use DoctrineModule\Stdlib\Hydrator\DoctrineObject as DoctrineHydrator;
use Exception;
use Zend\Mvc\Controller\AbstractActionController;
use Zend\Session\Container;
use Zend\View\Model\JsonModel;
use Zend\View\Model\ViewModel;

/**
 * Description of DepartmentController
 *
 * @author Márcio Dias <marciojr91@gmail.com>
 */
class DepartmentController extends AbstractActionController
{

    use EntityManagerService;

    public function indexAction()
    {
        return new ViewModel([]);
    }

    public function addAction()
    {
        $request = $this->getRequest();

        $message = null;
        try {

            $em = $this->getEntityManager();
            $form = new DepartmentForm($em);

            $department = new Department();
            $form->bind($department);

            if ($request->isPost()) {

                $form->setData($request->getPost());

                if ($form->isValid()) {

                    $em->persist($department);
                    $em->flush();

                    return $this->redirect()->toRoute('administrative-structure/department');
                }
            }


            return new ViewModel([
                'form' => $form,
                'message' => null,
            ]);
        } catch (Exception $ex) {
            if ($ex instanceof UniqueConstraintViolationException) {
                $message = 'Não é possivel cadastrar mais de um departamento com o mesmo nome: ' . $ex->getMessage();
            } else {
                $message = 'Erro inesperado: ' . $ex->getMessage();
            }
        }

        return new ViewModel([
            'message' => $message,
            'form' => null,
        ]);
    }

    public function getDepartmentsAction()
    {

        $results = [];

        try {
            $UserContainer = new Container('User');
            $em = $this->getEntityManager();

            if (empty($UserContainer->id)) {
                $departments = $em->getRepository('AdministrativeStructure\Entity\Department')->findBy(array(
                    'isActive' => true,
                    'parent' => null,
                ));
            } else {
                $departments = $em->getRepository('AdministrativeStructure\Entity\Department')->findBy(array(
                    'parent' => null
                ));
            }


            if (count($departments) > 0) {
                $hydrator = new DoctrineHydrator($em);
                foreach ($departments as $dep) {
                    $results[] = $hydrator->extract($dep);
                }
            }
            return new JsonModel([
                'message' => null,
                'results' => $results,
            ]);
        } catch (Exception $ex) {
            return new JsonModel([
                'message' => $ex->getMessage(),
                'results' => [],
            ]);
        }
    }

    public function editAction()
    {
        
    }

    public function deleteAction()
    {
        
    }

}